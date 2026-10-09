/* Merged into the generated service worker by @ducanh2912/next-pwa (customWorkerSrc "worker"). */

self.addEventListener("push", (event) => {
	let data = {};
	try {
		data = event.data ? event.data.json() : {};
	} catch {
		data = { body: event.data ? event.data.text() : "" };
	}
	const title = data.title || "Sauti Salama";
	event.waitUntil(
		Promise.all([
			self.registration.showNotification(title, {
				body: data.body || "",
				icon: "/icons/icons-192.png",
				badge: "/icons/icons-192.png",
				tag: data.tag || undefined,
				renotify: Boolean(data.tag),
				data: { url: data.url || "/dashboard" },
			}),
			// Counter on the installed app's icon.
			self.navigator && "setAppBadge" in self.navigator && data.badge
				? self.navigator.setAppBadge(data.badge).catch(() => {})
				: Promise.resolve(),
		])
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const url = new URL((event.notification.data && event.notification.data.url) || "/dashboard", self.location.origin).href;
	event.waitUntil(
		self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
			for (const w of wins) {
				if (new URL(w.url).origin === self.location.origin && "focus" in w) {
					return w.focus().then((c) => ("navigate" in c ? c.navigate(url) : c));
				}
			}
			return self.clients.openWindow(url);
		})
	);
});
