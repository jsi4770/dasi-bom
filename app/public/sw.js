// 다시-봄 Web Push용 최소 서비스워커.
// 오프라인 캐싱/프리캐시 전략은 의도적으로 넣지 않는다 — 기존 정적 웹 빌드(expo export -p web)의
// 캐시 동작을 건드리지 않고, push 알림 표시/클릭 처리만 담당한다.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: '다시 봄', body: event.data.text() };
  }

  const title = payload.title || '다시 봄';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const type = event.notification.data && event.notification.data.type;
  const targetUrl = type === 'medication' || type === 'mindfulness' ? `/medication?type=${type}` : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(targetUrl);
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
