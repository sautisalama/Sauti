/**
 * What each signed-in area says about itself when its link is shared. These cards are the same for everyone
 * (they describe the section, never a private record), so a crawler that cannot sign in still gets a real preview.
 */
export interface SectionInfo {
	label: string;
	title: string;
	description: string;
	/** What one record in the section is called, for links that point at a single item. */
	one?: string;
}

const M = "Mjengo";
export const SECTIONS: Record<string, SectionInfo> = {
	// Mjengo, the team workspace
	"mjengo": { label: M, title: "Mjengo workspace", description: "The Sauti Salama team workspace: grants, projects, documents, calls and mail in one place." },
	assistant: { label: M, title: "Salama assistant", description: "Ask Salama to draft, summarise and find things across the team's work." },
	brand: { label: M, title: "Brand kit", description: "Logos, colours, letterheads and templates for everything Sauti Salama publishes." },
	calendar: { label: M, title: "Team calendar", description: "Meetings, calls and deadlines for the Sauti Salama team. Sign in to see the invite and join.", one: "Calendar invite" },
	chat: { label: M, title: "Team chat", description: "Conversations and channels for the Sauti Salama team." },
	contacts: { label: M, title: "Contacts", description: "Partners, funders and supporters the team works with." },
	content: { label: M, title: "Content planner", description: "Ideas, drafts and engagement for Sauti Salama's posts and publications.", one: "Content item" },
	design: { label: M, title: "Design studio", description: "Posters, social cards and decks made with the Sauti Salama brand.", one: "Design" },
	documents: { label: M, title: "Documents", description: "Write, share and comment on documents with the team.", one: "Document" },
	fellowships: { label: M, title: "Fellowships", description: "Fellowships the team is tracking and applying to, with deadlines and progress.", one: "Fellowship" },
	files: { label: M, title: "Files", description: "The team's shared files and folders.", one: "File" },
	finance: { label: M, title: "Finance", description: "Invoices, receipts and budgets for Sauti Salama." },
	forms: { label: M, title: "Forms", description: "Build forms and collect responses from the community.", one: "Form" },
	grants: { label: M, title: "Grants", description: "Funding opportunities Sauti Salama is pursuing: deadlines, applications and reports.", one: "Grant" },
	logs: { label: M, title: "Activity log", description: "A record of who did what across the Mjengo workspace." },
	mail: { label: M, title: "Mail", description: "The team's shared inbox for Sauti Salama." },
	meetings: { label: M, title: "Meetings", description: "Video and voice calls, notes and recordings for the team.", one: "Meeting" },
	notifications: { label: M, title: "Notifications", description: "Updates from across the Mjengo workspace." },
	opportunities: { label: M, title: "Opportunities", description: "Calls, fellowships and partnerships worth a look, checked against the original source.", one: "Opportunity" },
	people: { label: M, title: "People and access", description: "Who is on the team and what they can open." },
	playbooks: { label: M, title: "Playbooks", description: "Step-by-step guides for how the team does its work.", one: "Playbook" },
	projects: { label: M, title: "Projects", description: "What Sauti Salama is building, who is on it and where it stands.", one: "Project" },
	todos: { label: M, title: "Tasks", description: "To-dos and who owns them across the team." },
	vault: { label: M, title: "Vault", description: "Private, access-controlled storage for sensitive team files.", one: "Vault file" },
	// The wider dashboard
	blogs: { label: "Blogs", title: "Blogs", description: "Stories and guidance on gender-based violence response, written for the Sauti Salama community.", one: "Blog post" },
	learning: { label: "Learning", title: "Learning", description: "Free self-paced courses and certificates from Sauti Salama.", one: "Course" },
	resources: { label: "Resources", title: "Resources", description: "Guides, templates and support information from Sauti Salama.", one: "Resource" },
	admin: { label: "Sauti Salama", title: "Administration", description: "Review profiles, services, publications and courses on Sauti Salama." },
	reports: { label: "Reports", title: "Reports", description: "Reports and follow-up on Sauti Salama." },
	cases: { label: "Cases", title: "Cases", description: "Cases and follow-up on Sauti Salama." },
	matches: { label: "Matches", title: "Matches", description: "Support services matched to reports on Sauti Salama." },
	services: { label: "Services", title: "Services", description: "Support services on Sauti Salama." },
	chats: { label: "Chat", title: "Messages", description: "Private conversations on Sauti Salama." },
	profile: { label: "Profile", title: "Profile", description: "Your Sauti Salama profile." },
	dashboard: { label: "Sauti Salama", title: "Your dashboard", description: "Support, services and tools for survivors, professionals and organisations in Kenya." },
};

/** Which section a dashboard address belongs to, and whether it points at a single record inside it. */
export function sectionFor(path: string[]): { key: string; info: SectionInfo; record: boolean } {
	const p = path[0] === "dashboard" ? path.slice(1) : path;
	const mj = p[0] === "mjengo";
	const key = mj ? p[1] ?? "mjengo" : p[0] ?? "dashboard";
	const info = SECTIONS[key] ?? SECTIONS[mj ? "mjengo" : "dashboard"];
	const depth = mj ? 2 : 1;
	return { key: SECTIONS[key] ? key : mj ? "mjengo" : "dashboard", info, record: p.length > depth };
}
