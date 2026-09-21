document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('all-courses-grid');
  let coursesList = typeof levelsData !== 'undefined' ? [...levelsData] : [];
  const localCourses = window.academyLocal ? window.academyLocal.courses() : [];
  localCourses.forEach((course) => mergeCourse(coursesList, course));

  renderCourses(container, coursesList);

  try {
    if (window.db && window.getDocs && window.collection) {
      const querySnapshot = await Promise.race([
        window.getDocs(window.collection(window.db, 'courses')),
        new Promise((resolve) => setTimeout(() => resolve(null), 1500))
      ]);
      if (querySnapshot) {
        querySnapshot.forEach((doc) => mergeCourse(coursesList, { id: doc.data().id || doc.id, ...doc.data() }));
        renderCourses(container, coursesList);
      }
    }
  } catch (error) {
    console.log('Firestore unavailable; keeping local courses:', error);
  }

  if (!coursesList.length) {
    container.innerHTML = '<p>No courses are available right now.</p>';
    return;
  }
});

function mergeCourse(courses, course) {
  const index = courses.findIndex((item) => Number(item.id) === Number(course.id));
  if (index >= 0) courses[index] = { ...courses[index], ...course };
  else courses.push(course);
}

function renderCourses(container, courses) {
  container.innerHTML = courses.map((course, index) => {
    const imageSrc = normalizeImagePath(course.image || `images/level${course.id || index + 1}.jpg`);

    return `
      <article class="course-card">
        <div class="card-image-wrapper">
          <img src="${escapeHtml(imageSrc)}" 
               alt="${escapeHtml(course.title || 'Course Image')}" 
               class="card-img" 
               onerror="this.onerror=null; this.src='https://via.placeholder.com/400x225?text=Level+${course.id || index + 1}';">
        </div>
        <div class="card-content">
          <h3>${escapeHtml(course.title || course.name || 'Untitled course')}</h3>
          <p style="margin: 0.8rem 0; color: #64748b;">${escapeHtml(course.desc || course.description || '')}</p>
          <span style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 4px; font-size: 0.85rem; font-weight: bold; display: inline-block; margin-bottom: 0.8rem;">
            ${escapeHtml(course.level || `Level ${course.id || index + 1}`)}
          </span>
          <div>
            <button class="btn-primary watch-course" type="button" style="width: 100%; border: none; cursor: pointer;">Watch Video</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  container.querySelectorAll('.watch-course').forEach((button, index) => {
    button.addEventListener('click', () => openVideoModal(courses[index]));
  });
}

function normalizeImagePath(path) {
  return String(path || '').replace(/^\.\.\/userweb\//, '');
}

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('video-modal');
  document.getElementById('close-modal').addEventListener('click', closeModal);
  window.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });
});

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[character]));
}

function openVideoModal(course) {
  const videoUrl = course.video || course.youtubeUrl || course.url;
  if (!videoUrl) return;

  document.getElementById('modal-title').textContent = '';
  document.getElementById('modal-description').textContent = '';
  const iframe = document.getElementById('modal-iframe');
  iframe.src = toEmbedUrl(videoUrl);
  document.getElementById('video-modal').style.display = 'flex';

  iframe.addEventListener('load', () => {
    iframe.contentWindow.postMessage(JSON.stringify({
      event: 'command',
      func: 'addEventListener',
      args: ['onStateChange']
    }), '*');
  }, { once: true });
}

function toEmbedUrl(url) {
  const value = String(url);
  const match = value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^?&#/]+)/);
  return match
    ? `https://www.youtube.com/embed/${match[1]}?autoplay=1&controls=1&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&enablejsapi=1`
    : value;
}

window.addEventListener('message', (event) => {
  if (!event.origin.includes('youtube.com')) return;
  let message;
  try {
    message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
  } catch (error) {
    return;
  }

  if (message.event === 'onStateChange' && Number(message.info) === 0) {
    closeModal();
  }
});

function closeModal() {
  document.getElementById('modal-iframe').src = '';
  document.getElementById('video-modal').style.display = 'none';
}