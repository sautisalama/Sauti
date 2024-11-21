import { getMaxListeners } from "events";

export const REPORT_EMAIL_RECIPIENTS = [
	// { email: "admin@sautisalama.org", name: "Sauti Salama Admin" },
	{ email: "oliver@sautisalama.org", name: "Oliver" },
	// { email: "malkia@sautisalama.org", name: "Malkia" },
	{ email: "oliverwai9na@gmail.com", name: "Oliver" },
];

export const REPORT_EMAIL_SENDER = {
	email: "report@sautisalama.org",
	name: "Sauti Salama Reports",
};

export const SUPPORT_SERVICE_OPTIONS = [
	{
		value: "legal",
		label: "Legal Support & Advocacy",
	},
	{
		value: "medical",
		label: "Medical Care & Treatment",
	},
	{
		value: "mental_health",
		label: "Mental Health Support",
	},
	{
		value: "shelter",
		label: "Emergency Shelter",
	},
	{
		value: "financial_assistance",
		label: "Financial Assistance",
	},
	{
		value: "other",
		label: "Other Support Services",
	},
] as const;

export type SupportServiceType =
	(typeof SUPPORT_SERVICE_OPTIONS)[number]["value"];

export const MATCH_STATUS_OPTIONS = [
	{
		value: "pending",
		label: "Pending",
	},
	{
		value: "accepted",
		label: "Accepted",
	},
	{
		value: "declined",
		label: "Declined",
	},
	{
		value: "completed",
		label: "Completed",
	},
	{
		value: "cancelled",
		label: "Cancelled",
	},
] as const;

export type MatchStatusType = (typeof MATCH_STATUS_OPTIONS)[number]["value"];

// 2c3c19b9-7bae-4aab-b3c1-5eeefa123d40
