/* Sauti Salama service worker: installability, offline fallback, and web push.
 * Hand-written (not generated): next-pwa is webpack-only and Next 16 builds with Turbopack. */
const VERSION = "v1";
const OFFLINE_URL = "/~offline";
const CACHE = `sauti-${VERSION}`;

self.addEventListener("install", (event) => {
	event.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE_URL)).catch(() => {}));
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k.startsWith("sauti-") && k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim())
	);
});

// Pages always come from the network (they are personal and dynamic); only a failed navigation shows the offline page.
self.addEventListener("fetch", (event) => {
	const req = event.request;
	if (req.mode !== "navigate") return;
	event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error())));
});

self.addEventListener("push", (event) => {
	let data = {};
	try {
		data = event.data ? event.data.json() : {};
	} catch {
		data = { body: event.data ? event.data.text() : "" };
	}
	event.waitUntil(
		Promise.all([
			data.chatId
				? fetch("/api/chat/delivered", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ chatId: data.chatId }),
						credentials: "same-origin",
					}).catch(() => {})
				: Promise.resolve(),
			self.registration.showNotification(data.title || "Sauti Salama", {
				body: data.body || "",
				icon: "/icons/icons-192.png",
				badge: "/icons/icons-96.png",
				tag: data.tag || undefined,
				renotify: Boolean(data.tag),
				data: { url: data.url || "/dashboard" },
			}),
			// Counter on the installed app's icon.
			data.badge && self.navigator && "setAppBadge" in self.navigator
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
