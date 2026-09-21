// Local Fallback Data
const academyData = {
  stats: {
    students: "1,200+",
    courses: "12 Levels",
    projects: "50+",
    satisfaction: "99%"
  },
  featuredCourses: [
    {
      id: "1",
      title: "Level 1: Web Development Basics",
      description: "Learn the fundamentals of HTML, CSS, and build your very first website.",
      level: "Beginner",
      image: "images/level1.jpg"
    },
    {
      id: "2",
      title: "Level 2: JavaScript Mastery",
      description: "Add interactivity to your website using logic, DOM manipulation, and APIs.",
      level: "Intermediate",
      image: "images/level2.jpg"
    },
    {
      id: "3",
      title: "Level 3: Fullstack Development",
      description: "Build complete web applications powered by modern databases and backend frameworks.",
      level: "Advanced",
      image: "images/level3.jpg"
    }
  ],
  announcements: [
    {
      title: "Welcome to RMCodelab Academy!",
      date: "August 2026",
      content: "Our brand new platform is officially live. Start learning in-demand digital skills today."
    }
  ]
};

// Make db globally accessible if needed
window.academyData = academyData;

window.academyLocal = {
  ticker: () => JSON.parse(localStorage.getItem('academyTicker') || 'null'),
  courses: () => Object.keys(localStorage)
    .filter((key) => key.indexOf('academyCourse_') === 0)
    .map((key) => JSON.parse(localStorage.getItem(key)))
    .sort((first, second) => first.id - second.id),
  news: () => JSON.parse(localStorage.getItem('academyNews') || '[]')
};

// Load Ticker & Dynamic Home Page Content
document.addEventListener('DOMContentLoaded', async () => {
  const tickerEl = document.getElementById('running-ticker');

  // Load Running Announcement Ticker (Firebase with Local Fallback)
  if (tickerEl) {
    const localTicker = window.academyLocal.ticker();
    tickerEl.textContent = localTicker || academyData.announcements[0].content;
    try {
      const docSnap = await window.getDoc(window.doc(window.db, "settings", "ticker"));
      if (docSnap.exists() && docSnap.data().text) {
        tickerEl.textContent = docSnap.data().text;
      } else {
        tickerEl.textContent = localTicker || academyData.announcements[0].content;
      }
    } catch (e) {
      tickerEl.textContent = localTicker || academyData.announcements[0].content;
    }
  }
});