// sw.js — Atlantas Admin Service Worker v3 (Real-Time + iOS Push)
var CACHE = 'atl-admin-v3';
var ASSETS = ['/', 'index.html', 'admin.js', 'config.js', 'pwa.js', 'manifest.json'];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); }).catch(function() {}));
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  if (e.request.url.indexOf('firebaseio.com') !== -1 ||
      e.request.url.indexOf('googleapis.com') !== -1 ||
      e.request.url.indexOf('gstatic.com') !== -1 ||
      e.request.url.indexOf('cloudinary.com') !== -1) {
    e.respondWith(fetch(e.request).catch(function() { return caches.match(e.request); }));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      var fetched = fetch(e.request).then(function(resp) {
        if (resp && resp.status === 200 && resp.type !== 'opaque') {
          caches.open(CACHE).then(function(c) { c.put(e.request, resp.clone()); });
        }
        return resp;
      }).catch(function() {});
      return cached || fetched;
    })
  );
});

// ── PUSH: fired by FCM even when app is closed (iOS 16.4+ PWA) ──
self.addEventListener('push', function(e) {
  var data = {
    title: 'Atlantas Admin',
    body: 'New activity requires your attention.',
    icon: 'https://i.imgur.com/iN8T10D.jpeg',
    badge: 'https://i.imgur.com/iN8T10D.jpeg',
    tag: 'atl-admin-' + Date.now(),
    requireInteraction: true,
    vibrate: [200, 100, 200]
  };
  try { if (e.data) { Object.assign(data, e.data.json()); } } catch (err) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      requireInteraction: data.requireInteraction,
      vibrate: data.vibrate,
      data: { url: data.url || '/' }
    })
  );
});

// ── NOTIFICATION CLICK: open/focus the app ───────────────────
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var target = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(cls) {
      for (var i = 0; i < cls.length; i++) {
        if (cls[i].focus) { cls[i].focus(); return; }
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});

// ── MESSAGE from app: relay CHECK_ALERTS to all open clients ─
self.addEventListener('message', function(e) {
  if (!e.data) return;
  if (e.data.type === 'CHECK_ALERTS' || e.data.type === 'PING') {
    self.clients.matchAll({ includeUncontrolled: true }).then(function(cls) {
      cls.forEach(function(c) { c.postMessage({ type: 'CHECK_ALERTS' }); });
    });
  }
  // Store push subscription endpoint for later use
  if (e.data.type === 'STORE_SUB') {
    // Subscription stored via admin.js directly to Firebase
  }
});

// ── BACKGROUND SYNC fallback ─────────────────────────────────
self.addEventListener('sync', function(e) {
  if (e.tag === 'atl-check-alerts') {
    e.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true }).then(function(cls) {
        cls.forEach(function(c) { c.postMessage({ type: 'CHECK_ALERTS' }); });
      })
    );
  }
});

// ── PERIODIC SYNC fallback (Android Chrome) ──────────────────
self.addEventListener('periodicsync', function(e) {
  if (e.tag === 'atl-realtime-check') {
    e.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true }).then(function(cls) {
        cls.forEach(function(c) { c.postMessage({ type: 'CHECK_ALERTS' }); });
      })
    );
  }
});
