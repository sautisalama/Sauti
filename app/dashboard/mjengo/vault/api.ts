import * as raw from "@/app/actions/vault";
import { unwrap } from "@/lib/action-result";

export type { VaultItem, VaultListing, AccessView, AccessEntry, PersonRow, RecipientCheck, FileMeta } from "@/app/actions/vault";

export const listVault = (...a: Parameters<typeof raw.listVault>) => unwrap(raw.listVault(...a));
export const createFolder = (...a: Parameters<typeof raw.createFolder>) => unwrap(raw.createFolder(...a));
export const prepareUpload = (...a: Parameters<typeof raw.prepareUpload>) => unwrap(raw.prepareUpload(...a));
export const registerUpload = async (...a: Parameters<typeof raw.registerUpload>) => {
	const item = await unwrap(raw.registerUpload(...a));
	void linkToRequestingRecord(item.id, item.name);
	return item;
};

/**
 * A file made in an editor that a grant, opportunity, project or fellowship asked for ("Create new" on its documents)
 * is linked to that record the moment it is first saved. Uploads from anywhere else are never linked this way.
 */
async function linkToRequestingRecord(fileId: string, name: string) {
	if (typeof window === "undefined") return;
	try {
		const { EDITOR_PATHS, hasPendingAttach, takePendingAttach } = await import("@/lib/client/pending-attach");
		if (!EDITOR_PATHS.test(window.location.pathname) || !hasPendingAttach()) return;
		const ask = takePendingAttach();
		if (!ask) return;
		const { attachVaultFile } = await import("@/app/actions/mjengo-attach");
		await unwrap(attachVaultFile(ask.kind as never, ask.entityId, fileId, ask.docId));
		const { toast } = await import("@/hooks/use-toast");
		toast({ title: "Added to the " + ask.kind, description: `${name} is now in its documents${ask.name ? ` (${ask.name})` : ""}.` });
	} catch { /* the file is saved either way; it can be added from the record by hand */ }
}
export const renameItem = (...a: Parameters<typeof raw.renameItem>) => unwrap(raw.renameItem(...a));
export const deleteItem = (...a: Parameters<typeof raw.deleteItem>) => unwrap(raw.deleteItem(...a));
export const getFileUrl = (...a: Parameters<typeof raw.getFileUrl>) => unwrap(raw.getFileUrl(...a));
export const getAccess = (...a: Parameters<typeof raw.getAccess>) => unwrap(raw.getAccess(...a));
export const setPermission = (...a: Parameters<typeof raw.setPermission>) => unwrap(raw.setPermission(...a));
export const setGeneralAccess = (...a: Parameters<typeof raw.setGeneralAccess>) => unwrap(raw.setGeneralAccess(...a));
export const listPeople = (...a: Parameters<typeof raw.listPeople>) => unwrap(raw.listPeople(...a));
export const searchFiles = (...a: Parameters<typeof raw.searchFiles>) => unwrap(raw.searchFiles(...a));
export const checkRecipients = (...a: Parameters<typeof raw.checkRecipients>) => unwrap(raw.checkRecipients(...a));
export const grantViewTo = (...a: Parameters<typeof raw.grantViewTo>) => unwrap(raw.grantViewTo(...a));
export const prepareReplace = (...a: Parameters<typeof raw.prepareReplace>) => unwrap(raw.prepareReplace(...a));
export const finishReplace = (...a: Parameters<typeof raw.finishReplace>) => unwrap(raw.finishReplace(...a));
export const fileMeta = (...a: Parameters<typeof raw.fileMeta>) => unwrap(raw.fileMeta(...a));
export const setFileMeta = (...a: Parameters<typeof raw.setFileMeta>) => unwrap(raw.setFileMeta(...a));
export const inviteByLink = (...a: Parameters<typeof raw.inviteByLink>) => unwrap(raw.inviteByLink(...a));
export const recentFiles = (...a: Parameters<typeof raw.recentFiles>) => unwrap(raw.recentFiles(...a));
export const notifyDocComment = (...a: Parameters<typeof raw.notifyDocComment>) => unwrap(raw.notifyDocComment(...a));
