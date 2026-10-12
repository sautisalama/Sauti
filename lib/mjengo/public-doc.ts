import { looseAdmin } from "@/lib/loose-db";

const UUID = /^[0-9a-f-]{36}$/i;

export interface PublicDoc { id: string; name: string; storage_path: string; mime: string | null; access: "view" | "edit" }

/** A file that its owner opened to anyone with the link, or null. Only the link setting grants anything here. */
export async function publicDoc(id: string): Promise<PublicDoc | null> {
	if (!UUID.test(id)) return null;
	const { data } = await looseAdmin().from("vault_files").select("id, name, storage_path, mime, link_access").eq("id", id).maybeSingle();
	if (!data || (data.link_access !== "view" && data.link_access !== "edit")) return null;
	return { id: data.id, name: data.name, storage_path: data.storage_path, mime: data.mime, access: data.link_access };
}
