/**
 * LinkedIn sharing for certificates.
 *  - "Add to profile" opens LinkedIn's own Licenses & certifications form, prefilled.
 *  - "Share" opens a ready post for the public certificate page (its preview image is the badge).
 * Set NEXT_PUBLIC_LINKEDIN_ORG_ID (the numeric id of the Sauti Salama LinkedIn page) so the entry shows our logo and links to the page.
 */
export const ISSUER_NAME = "Sauti Salama";

export function siteUrl(): string {
	const raw = (process.env.NEXT_PUBLIC_APP_URL || "https://sautisalama.org").replace(/\/$/, "");
	return raw.startsWith("http") ? raw : raw.startsWith("localhost") ? `http://${raw}` : `https://${raw}`;
}

export const certificateUrl = (number: string) => `${siteUrl()}/learn/certificates/${number}`;

export function linkedInAddToProfileUrl(c: { number: string; courseTitle: string; issuedAt: string }): string {
	const d = new Date(c.issuedAt);
	const orgId = process.env.NEXT_PUBLIC_LINKEDIN_ORG_ID;
	const params = new URLSearchParams({
		startTask: "CERTIFICATION_NAME",
		name: c.courseTitle.slice(0, 100),
		...(orgId ? { organizationId: orgId } : { organizationName: ISSUER_NAME }),
		issueYear: String(d.getUTCFullYear()),
		issueMonth: String(d.getUTCMonth() + 1),
		certUrl: certificateUrl(c.number),
		certId: c.number,
	});
	return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

export const linkedInShareUrl = (number: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(certificateUrl(number))}`;
