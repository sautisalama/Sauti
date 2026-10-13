/** "Added to" emails are off while the suite is being built; flip NEXT_PUBLIC_SHARE_EMAILS and SHARE_EMAILS to "on" together. */
export const SHARE_EMAIL_UI = process.env.NEXT_PUBLIC_SHARE_EMAILS === "on";
