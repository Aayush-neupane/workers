/* Sajilo Damak service worker — web-push display only. No caching, no
 * background sync: registration happens only when the user opts into push. */
self.addEventListener("push", (event) => {
  let data = { title: "Sajilo Damak", body: "", url: "/dashboard", tag: undefined };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* keep defaults */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body || "Open Sajilo Damak to see what's new.",
      tag: data.tag,
      data: { url: data.url || "/dashboard" },
      icon: "/logotrp.png",
      badge: "/logotrp.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || "/dashboard";
  const url = raw.startsWith("/") ? raw : "/dashboard"; // same-origin only
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        try {
          if (new URL(w.url).pathname === url.split("?")[0]) return w.focus();
        } catch {
          /* ignore unparsable */
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
