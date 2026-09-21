const firebaseConfig = {
  apiKey: "AIzaSyAalxUPuYwF556UN32_-SLxEIirmeI7JIM",
  authDomain: "html-project-fac38.firebaseapp.com",
  projectId: "html-project-fac38",
  storageBucket: "html-project-fac38.firebasestorage.app",
  messagingSenderId: "396617400947",
  appId: "1:396617400947:web:abbba7be1586e5b9c66006",
  measurementId: "G-XJRN8JB1YK"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
let editingNewsId = null;

function showOperationResult(message, success) {
  const status = document.getElementById('operation-status');
  if (status) {
    status.textContent = message;
    status.style.display = 'block';
    status.style.color = success ? '#166534' : '#991b1b';
    status.style.backgroundColor = success ? '#dcfce7' : '#fee2e2';
  }
  if (!success) console.error(message);
}

function saveLocalValue(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function saveLocalNews(item) {
  const current = JSON.parse(localStorage.getItem('academyNews') || '[]');
  current.unshift(item);
  saveLocalValue('academyNews', current);
}

function withTimeout(operation, milliseconds = 1500) {
  return Promise.race([
    operation,
    new Promise((resolve, reject) => setTimeout(() => reject(new Error('Firebase request timed out')), milliseconds))
  ]);
}

function getLocalCourses() {
  return Object.keys(localStorage)
    .filter((key) => key.indexOf('academyCourse_') === 0)
    .map((key) => JSON.parse(localStorage.getItem(key)))
    .sort((first, second) => first.id - second.id);
}

function removeLocalNews(id) {
  saveLocalValue('academyNews', JSON.parse(localStorage.getItem('academyNews') || '[]').filter((item) => item.id !== id && item.remoteId !== id));
}

function renderManagedContent() {
  const list = document.getElementById('admin-content-list');
  if (!list) return;
  const courses = getLocalCourses();
  const news = JSON.parse(localStorage.getItem('academyNews') || '[]');
  const ticker = localStorage.getItem('academyTicker') ? [{ id: 'ticker', title: JSON.parse(localStorage.getItem('academyTicker')) }] : [];
  const rows = [
    ...ticker.map((item) => ({ type: 'ticker', id: item.id, title: `Ticker: ${item.title}` })),
    ...courses.map((item) => ({ type: 'course', id: item.id, title: item.title })),
    ...news.map((item) => ({ type: 'news', id: item.id, title: item.title }))
  ];
  list.innerHTML = rows.length ? rows.map((item) => `
    <div class="content-row">
      <strong>${escapeHtml(item.title)}</strong>
      <div class="content-actions">
        ${item.type === 'ticker' ? '<button class="btn-small btn-edit" data-action="edit" data-type="ticker" data-id="ticker" type="button">Edit</button>' : ''}
        ${item.type === 'course' || item.type === 'news' ? `<button class="btn-small btn-edit" data-action="edit" data-type="${item.type}" data-id="${item.id}" type="button">Edit</button>` : ''}
        <button class="btn-small btn-delete" data-action="delete" data-type="${item.type}" data-id="${item.id}" data-remote-id="${item.remoteId || ''}" type="button">Delete</button>
      </div>
    </div>
  `).join('') : '<p>No locally added content yet.</p>';
}

function deleteManagedContent(type, id) {
  if (type === 'ticker') {
    localStorage.removeItem('academyTicker');
    db.collection('settings').doc('ticker').delete().catch(() => {});
  } else if (type === 'course') {
    localStorage.removeItem(`academyCourse_${id}`);
    db.collection('courses').doc(`level_${id}`).delete().catch(() => {});
  } else {
    removeLocalNews(id);
    db.collection('news').doc(id).delete().catch(() => {});
  }
  renderManagedContent();
  showOperationResult('Content deleted.', true);
}

async function loadRemoteContent() {
  try {
    const [courseSnapshot, newsSnapshot, tickerSnapshot] = await Promise.race([
      Promise.all([
        db.collection('courses').get(),
        db.collection('news').get(),
        db.collection('settings').doc('ticker').get()
      ]),
      new Promise((resolve) => setTimeout(() => resolve(null), 1500))
    ]);
    if (!courseSnapshot) return;
    courseSnapshot.forEach((doc) => saveLocalValue(`academyCourse_${doc.data().id || doc.id.replace('level_', '')}`, { id: doc.data().id || doc.id.replace('level_', ''), ...doc.data() }));
    const localNews = JSON.parse(localStorage.getItem('academyNews') || '[]');
    newsSnapshot.forEach((doc) => {
      const data = doc.data();
      const existing = localNews.find((item) => item.id === data.id || item.remoteId === doc.id);
      if (existing) {
        Object.assign(existing, data, { remoteId: doc.id });
      } else {
        localNews.push({ ...data, id: data.id || doc.id, remoteId: doc.id });
      }
    });
    saveLocalValue('academyNews', localNews);
    if (tickerSnapshot.exists && tickerSnapshot.data().text) saveLocalValue('academyTicker', tickerSnapshot.data().text);
    renderManagedContent();
  } catch (error) {
    console.log('Remote admin content unavailable; using local content.', error);
  }
}

async function deleteAllAnnouncements() {
  localStorage.removeItem('academyNews');
  editingNewsId = null;
  renderManagedContent();
  try {
    const snapshot = await withTimeout(db.collection('news').get());
    const batch = db.batch();
    snapshot.forEach((doc) => batch.delete(doc.ref));
    if (!snapshot.empty) await withTimeout(batch.commit());
    showOperationResult('All announcements were deleted.', true);
  } catch (error) {
    showOperationResult('Local announcements were cleared. Firebase cleanup will retry when available.', true);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const levelSelect = document.getElementById('course-level');
  
  // Auto-fill fields when level is changed
  levelSelect.addEventListener('change', async (e) => {
    const selectedLevel = e.target.value;
    const localCourse = localStorage.getItem(`academyCourse_${selectedLevel}`);
    if (localCourse) fillCourseForm(JSON.parse(localCourse));
    else {
      document.getElementById('course-title').value = '';
      document.getElementById('course-desc').value = '';
      document.getElementById('course-video').value = '';
      document.getElementById('course-image').value = `../userweb/images/level${selectedLevel}.jpg`;
    }
    try {
      const docSnap = await Promise.race([
        db.collection('courses').doc(`level_${selectedLevel}`).get(),
        new Promise((resolve) => setTimeout(() => resolve(null), 1200))
      ]);
        if (docSnap && docSnap.exists) {
        fillCourseForm(docSnap.data());
      }
    } catch (err) {
      console.error("Error loading course data:", err);
    }
  });

  // 1. Save Running Ticker
  document.getElementById('btn-save-ticker').addEventListener('click', async () => {
    const text = document.getElementById('ticker-input').value.trim();
    if (!text) {
      showOperationResult('Not successful: enter announcement text first.', false);
      return;
    }
      saveLocalValue('academyTicker', text);
      renderManagedContent();
    try {
      await withTimeout(db.collection('settings').doc('ticker').set({ text: text, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }));
      showOperationResult('Success: ticker updated and saved to Firebase.', true);
    } catch (error) {
      showOperationResult('Saved on this device. Enable Firestore to share it across devices.', true);
    }
  });

  // 2. Save / Edit Course Level
  document.getElementById('btn-save-course').addEventListener('click', async () => {
    const levelId = parseInt(levelSelect.value);
    const title = document.getElementById('course-title').value.trim();
    const desc = document.getElementById('course-desc').value.trim();
    const video = document.getElementById('course-video').value.trim();
    const image = document.getElementById('course-image').value.trim() || `../userweb/images/level${levelId}.jpg`;

    if (!title || !video) {
      showOperationResult('Not successful: title and video URL are required.', false);
      return;
    }

    try {
      const course = {
        id: levelId,
        title: title,
        desc: desc,
        video: video,
        image: image,
        level: `Level ${levelId}`
      };
        saveLocalValue(`academyCourse_${levelId}`, course);
      await withTimeout(db.collection('courses').doc(`level_${levelId}`).set(course));
      showOperationResult(`Success: Level ${levelId} was saved to Firebase.`, true);
      renderManagedContent();
    } catch (error) {
      showOperationResult('Saved on this device. Enable Firestore to share it across devices.', true);
      renderManagedContent();
    }
  });

  // 3. Save News Announcement
  document.getElementById('btn-save-news').addEventListener('click', async () => {
    const title = document.getElementById('news-title').value.trim();
    const content = document.getElementById('news-content').value.trim();

    if (!title || !content) {
      showOperationResult('Not successful: news title and content are required.', false);
      return;
    }

    const newsItem = {
      id: String(Date.now()),
        title: title,
        content: content,
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        createdAt: new Date()
    };
    try {
      if (editingNewsId) {
        const savedNews = JSON.parse(localStorage.getItem('academyNews') || '[]');
        saveLocalValue('academyNews', savedNews.map((item) => item.id === editingNewsId || item.remoteId === editingNewsId ? { ...item, ...newsItem, id: item.id, remoteId: item.remoteId } : item));
        await withTimeout(db.collection('news').doc(editingNewsId).set(newsItem, { merge: true }));
        editingNewsId = null;
      } else {
        saveLocalNews(newsItem);
        await withTimeout(db.collection('news').doc(newsItem.id).set(newsItem));
      }
      showOperationResult('Success: announcement published to Firebase.', true);
      document.getElementById('news-title').value = '';
      document.getElementById('news-content').value = '';
      renderManagedContent();
    } catch (error) {
      showOperationResult('Saved on this device. Enable Firestore to share it across devices.', true);
      document.getElementById('news-title').value = '';
      document.getElementById('news-content').value = '';
      renderManagedContent();
    }
  });

  document.getElementById('btn-delete-all-news').addEventListener('click', deleteAllAnnouncements);
  const contentList = document.getElementById('admin-content-list');
  if (contentList) contentList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const type = button.dataset.type;
    const id = button.dataset.id;
    const remoteId = button.dataset.remoteId || id;
    if (button.dataset.action === 'delete') {
      if (window.confirm('Delete this content?')) deleteManagedContent(type, type === 'news' ? remoteId : id);
      return;
    }
    if (type === 'ticker') document.getElementById('ticker-input').value = JSON.parse(localStorage.getItem('academyTicker') || '""');
    if (type === 'course') {
      levelSelect.value = id;
      fillCourseForm(JSON.parse(localStorage.getItem(`academyCourse_${id}`)));
    }
    if (type === 'news') {
      const item = JSON.parse(localStorage.getItem('academyNews') || '[]').find((news) => news.id === id);
      if (item) {
        editingNewsId = item.remoteId || item.id;
        document.getElementById('news-title').value = item.title || '';
        document.getElementById('news-content').value = item.content || '';
        showOperationResult('Announcement loaded for editing.', true);
      }
    }
  });

  renderManagedContent();
  loadRemoteContent();
});

function fillCourseForm(course) {
  if (!course) return;
  document.getElementById('course-title').value = course.title || '';
  document.getElementById('course-desc').value = course.desc || '';
  document.getElementById('course-video').value = course.video || '';
  document.getElementById('course-image').value = course.image || `../userweb/images/level${course.id}.jpg`;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[character]));
}