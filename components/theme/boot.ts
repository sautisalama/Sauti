/** Shared by the server layout and the client theme store, so this file must not be a client module. */
export const THEME_KEY = "ss_theme";

/** Dark applies to the signed-in app and meetings; the public site keeps its own look. */
export const inThemedArea = (pathname: string) => pathname.startsWith("/dashboard") || pathname.startsWith("/meet");

/** Runs before the first paint (inlined in <head>) so the page never flashes light before turning dark. */
export const THEME_BOOT_SCRIPT = `try{var c=localStorage.getItem("${THEME_KEY}")||"system";var p=location.pathname;var a=p.indexOf("/dashboard")===0||p.indexOf("/meet")===0;var d=a&&(c==="dark"||(c==="system"&&matchMedia("(prefers-color-scheme: dark)").matches));document.documentElement.classList.toggle("dark",d)}catch(e){}`;
