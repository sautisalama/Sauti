import * as raw from "@/app/actions/vault";
import { unwrap } from "@/lib/action-result";

export type { VaultItem, VaultListing, AccessView, AccessEntry, PersonRow, RecipientCheck } from "@/app/actions/vault";

export const listVault = (...a: Parameters<typeof raw.listVault>) => unwrap(raw.listVault(...a));
export const createFolder = (...a: Parameters<typeof raw.createFolder>) => unwrap(raw.createFolder(...a));
export const prepareUpload = (...a: Parameters<typeof raw.prepareUpload>) => unwrap(raw.prepareUpload(...a));
export const registerUpload = (...a: Parameters<typeof raw.registerUpload>) => unwrap(raw.registerUpload(...a));
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
