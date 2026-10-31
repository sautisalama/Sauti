/** Shared by the server layout and the client theme store, so this file must not be a client module. */
export const THEME_KEY = "ss_theme";

/** Dark applies everywhere, public site included, so the choice never changes under someone mid-visit. */
export const inThemedArea = (_pathname: string) => true;

/** Runs before the first paint (inlined in <head>) so the page never flashes light before turning dark. */
export const THEME_BOOT_SCRIPT = `try{var c=localStorage.getItem("${THEME_KEY}")||"system";var p=location.pathname;var d=(c==="dark"||(c==="system"&&matchMedia("(prefers-color-scheme: dark)").matches));document.documentElement.classList.toggle("dark",d)}catch(e){}`;
