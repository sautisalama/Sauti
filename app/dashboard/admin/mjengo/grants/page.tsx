import { EntityWorkspace } from "../_components/EntityWorkspace";

export const metadata = { title: "grants" };

export default function Page() {
	return <EntityWorkspace kind="grant" />;
}
