import { EntityWorkspace } from "../_components/EntityWorkspace";

export const metadata = { title: "fellowships" };

export default function Page() {
	return <EntityWorkspace kind="fellowship" />;
}
