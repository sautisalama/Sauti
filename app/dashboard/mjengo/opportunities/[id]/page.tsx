import { EntityWorkspace } from "../../_components/EntityWorkspace";

export const metadata = { title: "opportunity" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	return <EntityWorkspace kind="opportunity" pageId={id} />;
}
