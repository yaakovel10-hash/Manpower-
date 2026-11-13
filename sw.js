// מעקב כוח אדם – שמירת האפליקציה בטלפון כדי שתיפתח מיד, גם בלי אינטרנט.
// הנתונים עצמם (חיילים, אמל"ח וכו') נשמרים על ידי Firebase, לא כאן.
const CACHE = "manpower-v5";
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

// בודק ברקע אם עלתה גרסה חדשה של האפליקציה. אם כן – שומר אותה ומודיע לאפליקציה הפתוחה.
let checking = null;
function checkForUpdate() {
  if (checking) return checking;
  checking = (async () => {
    try {
      const res = await fetch("./index.html", { cache: "no-cache" }); // שואל את השרת "השתנה?" – אם לא, כמעט לא יורד כלום
      if (!res.ok) return;
      const fresh = await res.clone().text();
      const c = await caches.open(CACHE);
      const old = await c.match("./index.html");
      const oldText = old ? await old.text() : null;
      if (oldText === fresh) return;
      await c.put("./index.html", res);
      if (oldText !== null) {
        const list = await self.clients.matchAll({ type: "window" });
        list.forEach(cl => cl.postMessage({ type: "new-version" }));
      }
    } catch (_) {} finally { checking = null; }
  })();
  return checking;
}

self.addEventListener("message", e => { if (e.data && e.data.type === "check") e.waitUntil(checkForUpdate()); });

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // דף האפליקציה: נפתח מיד מהעותק השמור, ובמקביל בודק אם יש גרסה חדשה
  if (req.mode === "navigate" || (sameOrigin && /\/(index\.html)?$/.test(url.pathname))) {
    e.respondWith((async () => {
      const hit = await caches.match("./index.html");
      if (hit) { e.waitUntil(checkForUpdate()); return hit; }
      try {
        const res = await fetch(req);
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); }
        return res;
      } catch (_) { return (await caches.match("./")) || Response.error(); }
    })());
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
