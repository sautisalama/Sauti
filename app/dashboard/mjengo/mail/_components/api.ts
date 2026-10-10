import * as raw from '@/app/actions/mjengo-mail';
import { unwrap } from '@/lib/action-result';

export type { LabelRow, AccountView, AddAccountInput, MessageRow, ListQuery, MailAction, SendInput, ViewConfig, ViewRow, SnippetRow } from '@/app/actions/mjengo-mail';

export const listAccounts = (...a: Parameters<typeof raw.listAccounts>) => unwrap(raw.listAccounts(...a));
export const addAccount = (...a: Parameters<typeof raw.addAccount>) => unwrap(raw.addAccount(...a));
export const removeAccount = (...a: Parameters<typeof raw.removeAccount>) => unwrap(raw.removeAccount(...a));
export const getMailboxes = (...a: Parameters<typeof raw.getMailboxes>) => unwrap(raw.getMailboxes(...a));
export const listMessages = (...a: Parameters<typeof raw.listMessages>) => unwrap(raw.listMessages(...a));
export const getMessageDetail = (...a: Parameters<typeof raw.getMessageDetail>) => unwrap(raw.getMessageDetail(...a));
export const getConversation = (...a: Parameters<typeof raw.getConversation>) => unwrap(raw.getConversation(...a));
export const actOnMessages = (...a: Parameters<typeof raw.actOnMessages>) => unwrap(raw.actOnMessages(...a));
export const sendMail = (...a: Parameters<typeof raw.sendMail>) => unwrap(raw.sendMail(...a));
export const listViews = (...a: Parameters<typeof raw.listViews>) => unwrap(raw.listViews(...a));
export const saveView = (...a: Parameters<typeof raw.saveView>) => unwrap(raw.saveView(...a));
export const deleteView = (...a: Parameters<typeof raw.deleteView>) => unwrap(raw.deleteView(...a));
export const listSnippets = (...a: Parameters<typeof raw.listSnippets>) => unwrap(raw.listSnippets(...a));
export const saveSnippet = (...a: Parameters<typeof raw.saveSnippet>) => unwrap(raw.saveSnippet(...a));
export const deleteSnippet = (...a: Parameters<typeof raw.deleteSnippet>) => unwrap(raw.deleteSnippet(...a));
export const summariseMessage = (...a: Parameters<typeof raw.summariseMessage>) => unwrap(raw.summariseMessage(...a));
export const draftReply = (...a: Parameters<typeof raw.draftReply>) => unwrap(raw.draftReply(...a));
export const oauthAvailability = (...a: Parameters<typeof raw.oauthAvailability>) => unwrap(raw.oauthAvailability(...a));
export const listLabels = (...a: Parameters<typeof raw.listLabels>) => unwrap(raw.listLabels(...a));
export const saveLabel = (...a: Parameters<typeof raw.saveLabel>) => unwrap(raw.saveLabel(...a));
export const deleteLabel = (...a: Parameters<typeof raw.deleteLabel>) => unwrap(raw.deleteLabel(...a));
export const setMessageLabel = (...a: Parameters<typeof raw.setMessageLabel>) => unwrap(raw.setMessageLabel(...a));
export const autoLabel = (...a: Parameters<typeof raw.autoLabel>) => unwrap(raw.autoLabel(...a));
export const rewriteText = (...a: Parameters<typeof raw.rewriteText>) => unwrap(raw.rewriteText(...a));
