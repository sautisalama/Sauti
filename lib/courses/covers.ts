/**
 * Feature photos for courses. An admin can pick one of these in the course builder (or paste any URL);
 * a course with no cover still gets a photo, chosen from its slug so it never changes.
 */
export const COURSE_COVERS: { url: string; label: string }[] = [
	{ url: "/blog/empowerment.jpeg", label: "Empowerment" },
	{ url: "/blog/certification.jpeg", label: "Certification" },
	{ url: "/blog/justice.jpg", label: "Justice" },
	{ url: "/landing/landing.jpeg", label: "Community" },
	{ url: "/landing/landing2.jpeg", label: "Together" },
	{ url: "/impact-image.jpeg", label: "Impact" },
	{ url: "/learn/amina.jpg", label: "Learning" },
	{ url: "/couple-salama.jpg", label: "Support" },
	{ url: "/events/impact/malkia teaching child.jpeg", label: "Teaching" },
	{ url: "/events/impact/teaching chess to children.jpeg", label: "Children" },
	{ url: "/events/impact/16-days of activism 2.jpeg", label: "Activism" },
	{ url: "/events/programs/community-wangu.jpeg", label: "Community programme" },
];

function hash(s: string): number {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
	return h;
}

export function coverFor(course: { slug: string; cover_image_url?: string | null }): string {
	const own = course.cover_image_url?.trim();
	if (own) return own;
	return COURSE_COVERS[hash(course.slug) % COURSE_COVERS.length].url;
}
