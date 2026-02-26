// Push notification handler for PWA
self.addEventListener('push', function(event) {
  let data = { title: 'Gama Order Flow', body: 'Novo obaveštenje' };
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    // If parsing fails, use text
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || data.message || 'Novo obaveštenje',
    icon: '/pwa-icon-192.png',
    badge: '/pwa-icon-192.png',
    tag: 'portal-notification',
    renotify: true,
    data: data.data || {},
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Gama Order Flow', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Focus existing window or open new one
      for (const client of clientList) {
        if (client.url.includes('/portal') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('/portal');
    })
  );
});
