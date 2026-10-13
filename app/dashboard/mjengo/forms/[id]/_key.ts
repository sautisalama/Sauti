/** The edit-link key of the form being edited by someone who is not signed in (null for administrators). */
let key: string | null = null;
export const setEditKey = (k: string | null) => { key = k; };
export const editKey = () => key;
