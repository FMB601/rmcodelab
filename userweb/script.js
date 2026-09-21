document.addEventListener('DOMContentLoaded', async () => {
  
  // 1. Populate Statistics
  if (typeof academyData !== 'undefined') {
    document.getElementById('stat-students').innerText = academyData.stats.students;
    document.getElementById('stat-courses').innerText = academyData.stats.courses;
    document.getElementById('stat-projects').innerText = academyData.stats.projects;
    document.getElementById('stat-satisfaction').innerText = academyData.stats.satisfaction;
  }

  // 2. Fetch Featured Courses from Firestore or fallback to data.js
  const coursesContainer = document.getElementById('featured-courses');
  
  if (coursesContainer) {
    const localCourses = window.academyLocal ? window.academyLocal.courses() : [];
    renderFeaturedCourses(coursesContainer, localCourses);
    try {
      if (window.db) {
        const querySnapshot = await Promise.race([
          window.getDocs(window.collection(window.db, "courses")),
          new Promise((resolve) => setTimeout(() => resolve(null), 1500))
        ]);
        
        if (querySnapshot && !querySnapshot.empty) {
          const remoteCourses = [];
          querySnapshot.forEach((doc) => {
            remoteCourses.push(doc.data());
          });
          renderFeaturedCourses(coursesContainer, remoteCourses);
        }
      }
    } catch (error) {
      console.log("Firebase query unsuccessful, using fallback data.js:", error);
    }

  }

  // 3. Render Announcements from Firestore, with local fallback
  const newsContainer = document.getElementById('latest-announcements');
  if (newsContainer) {
    let announcements = [];
    if (window.academyLocal) {
      announcements = window.academyLocal.news();
      renderAnnouncements(newsContainer, announcements);
    }

    try {
      if (window.db && window.getDocs && window.collection) {
        const newsSnapshot = await window.getDocs(window.collection(window.db, 'news'));
        newsSnapshot.forEach((doc) => announcements.push(doc.data()));
      }
    } catch (error) {
      console.log('News query unsuccessful, using fallback data.js:', error);
    }

    if (!announcements.length && window.academyLocal) {
      announcements = window.academyLocal.news();
    }
    if (!announcements.length && typeof academyData !== 'undefined') {
      announcements = academyData.announcements || [];
    }

    renderAnnouncements(newsContainer, announcements);
  }
});

function renderAnnouncements(newsContainer, announcements) {
  newsContainer.innerHTML = announcements.map((item) => `
      <div style="background: white; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #0070f3;">
        <small style="color: #64748b;">${escapeHtml(item.date || 'Announcement')}</small>
        <h3 style="margin-top: 5px;">${escapeHtml(item.title || 'Academy update')}</h3>
        <p style="margin-top: 10px;">${escapeHtml(item.content || item.desc || item.description || '')}</p>
      </div>
  `).join('');
}

function renderFeaturedCourses(container, courses) {
  const fallback = typeof academyData !== 'undefined' ? academyData.featuredCourses : [];
  const source = courses.length ? courses : fallback;
  const featured = [1, 2, 3]
    .map((level) => source.find((course) => Number(course.id) === level) || fallback[level - 1])
    .filter(Boolean);
  container.innerHTML = featured.map((course) => createCourseCard(course)).join('');
}

// Helper function to render course card HTML
function createCourseCard(course) {
  const levelId = Number(course.id) || 1;
  const image = String(course.image || `images/level${levelId}.jpg`).replace(/^\.\.\/userweb\//, '');
  return `
    <div class="course-card">
        <div class="card-image-wrapper"><img src="${escapeHtml(image)}" alt="${escapeHtml(course.title || 'Course image')}" class="card-img"></div>
      <h3>${escapeHtml(course.title || course.name || 'Untitled course')}</h3>
      <p style="margin: 0.8rem 0; color: #64748b;">${escapeHtml(course.description || course.desc || '')}</p>
      <span style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 4px; font-size: 0.85rem; font-weight: bold;">${escapeHtml(course.level || 'Beginner')}</span>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[character]));
}