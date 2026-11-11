// מעקב כוח אדם – שמירת האפליקציה בטלפון כדי שתיפתח גם בלי אינטרנט.
// הנתונים עצמם (חיילים, אמל"ח וכו') נשמרים על ידי Firebase, לא כאן.
const CACHE = "manpower-v4";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js",
  "https://fonts.googleapis.com/css2?family=Secular+One&family=Assistant:wght@400;600;700&display=swap"
];
// קבצים חיצוניים שמותר לשמור: ספריות Firebase, גופנים וקורא ה-PDF
const CACHEABLE = [
  "https://www.gstatic.com/firebasejs/",
  "https://fonts.googleapis.com/",
  "https://fonts.gstatic.com/",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // דף האפליקציה: קודם מהרשת (כדי לקבל עדכונים), ואם אין קליטה – מהעותק השמור
  if (req.mode === "navigate" || (sameOrigin && /\/(index\.html)?$/.test(url.pathname))) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); }
        return res;
      }).catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // ספריות וגופנים: מהעותק השמור, ובמקביל מתעדכן מהרשת
  if (sameOrigin || CACHEABLE.some(p => req.url.startsWith(p))) {
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req).then(res => {
          if (res && (res.ok || res.type === "opaque")) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
  }
  // כל השאר (למשל התקשורת עם Firebase) עובר כרגיל
});
