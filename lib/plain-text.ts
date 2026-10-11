/** Instruction appended to every prompt that writes text for people. */
export const NO_DASH_RULE = 'Write like a person. Never use em dashes or en dashes; use commas, full stops or the word "to" instead.';

/** Safety net for model output: em and en dashes become commas (or hyphens inside ranges). */
export function stripDashes(s: string): string {
  return s
    .replace(/(\d)\s*[–—]\s*(\d)/g, '$1-$2')
    .replace(/\s*[–—]\s*/g, ', ')
    .replace(/,\s*,/g, ',');
}
