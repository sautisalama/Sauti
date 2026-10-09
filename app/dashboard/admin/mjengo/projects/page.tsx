import { EntityWorkspace } from "../_components/EntityWorkspace";

export const metadata = { title: "projects" };

export default function Page() {
	return <EntityWorkspace kind="project" />;
}
