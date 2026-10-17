/** What the browser and the server both need to know about Salama, the team's AI member. */
export const SALAMA = { id: 'salama', name: 'Salama', email: 'salama@sautisalama.org' } as const;

/** Does a spoken or typed line speak to Salama ("Salama, ...", "hey Salama ...", "@Salama ...")? Returns the question. */
export function addressedToSalama(text: string): string | null {
  const m = /^\s*(?:(?:hey|hi|ok|okay|hello)[\s,]+)?@?salama\b[\s,:;.!-]*(.*)$/i.exec(text);
  const q = m?.[1]?.trim();
  return q && q.length > 1 ? q : null;
}
