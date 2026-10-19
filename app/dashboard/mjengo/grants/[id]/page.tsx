import { EntityWorkspace } from "../../_components/EntityWorkspace";

export const metadata = { title: "grant" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	return <EntityWorkspace kind="grant" pageId={id} />;
}
