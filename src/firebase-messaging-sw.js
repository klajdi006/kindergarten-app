// Firebase Cloud Messaging service worker.
// Served at /firebase-messaging-sw.js so FCM SDK picks it up automatically.
// Coexists with the Angular ngsw at /ngsw-worker.js (different scopes).

importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCYJV34OFxv1FBeI5W36eWEiW5JzWHzih0',
  authDomain: 'e-kindergaten-app.firebaseapp.com',
  projectId: 'e-kindergaten-app',
  storageBucket: 'e-kindergaten-app.firebasestorage.app',
  messagingSenderId: '510259741725',
  appId: '1:510259741725:web:1229444495b081ab75f2f4',
});

const messaging = firebase.messaging();

// Triggered when a data-only push arrives while the page is backgrounded.
// (If the payload includes a `notification` block, the browser auto-renders
// it and this handler is not invoked.)
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'New notification';
  const options = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/assets/icon/favicon.png',
    data: payload.data || {},
    // Tagging collapses multiple notifications with the same tag (e.g. a
    // burst of photos to one album) into a single on-screen notification.
    tag: payload.data?.tag || undefined,
    renotify: false,
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const payload = event.notification.data || {};

  event.waitUntil((async () => {
    const wins = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Prefer the most recently focused client. If we have any open client,
    // post the payload to it and bring it forward — the app handles routing
    // because only the app knows the user's role + the role-prefixed paths.
    if (wins.length > 0) {
      const target = wins.find((w) => w.focused) ?? wins[0];
      target.postMessage({ source: 'fcm-click', payload });
      if ('focus' in target) await target.focus();
      return;
    }
    // No client open — cold-start the app at root with the payload encoded
    // in the query string. AppComponent reads it on boot.
    if (clients.openWindow) {
      const encoded = encodeURIComponent(JSON.stringify(payload));
      await clients.openWindow(`/?notif=${encoded}`);
    }
  })());
});
