import { askAi } from '@/lib/mjengo/ai';

import { type FlowEdge, type FlowGraph, type FlowNode, type FlowNodeKind } from '@/lib/mjengo/flow-graph';

export type { FlowEdge, FlowGraph, FlowNode, FlowNodeKind };

const MAX_NODES = 30;
const clean = (s: unknown, n: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '');

/**
 * Make sure a model's flow is a real graph: unique ids, short labels, edges only between nodes that exist, no loops
 * back onto the same node, at most 30 steps. Anything else is dropped, never repaired by guessing.
 */
export function cleanGraph(raw: unknown): FlowGraph {
  const r = (raw ?? {}) as { title?: unknown; nodes?: unknown; edges?: unknown };
  const seen = new Set<string>();
  const nodes: FlowNode[] = [];
  for (const n of Array.isArray(r.nodes) ? r.nodes : []) {
    const o = n as { id?: unknown; label?: unknown; kind?: unknown };
    const id = clean(o.id, 24).replace(/[^\w-]/g, '');
    const label = clean(o.label, 70);
    if (!id || !label || seen.has(id) || nodes.length >= MAX_NODES) continue;
    seen.add(id);
    const kind: FlowNodeKind = o.kind === 'start' || o.kind === 'end' || o.kind === 'decision' ? o.kind : 'step';
    nodes.push({ id, label, kind });
  }
  const edges: FlowEdge[] = [];
  const key = new Set<string>();
  for (const e of Array.isArray(r.edges) ? r.edges : []) {
    const o = e as { from?: unknown; to?: unknown; label?: unknown };
    const from = clean(o.from, 24).replace(/[^\w-]/g, '');
    const to = clean(o.to, 24).replace(/[^\w-]/g, '');
    if (!seen.has(from) || !seen.has(to) || from === to || key.has(`${from}>${to}`)) continue;
    key.add(`${from}>${to}`);
    const label = clean(o.label, 30);
    edges.push(label ? { from, to, label } : { from, to });
  }
  return { title: clean(r.title, 80), nodes, edges };
}

const SYSTEM = `You turn a description of a process into a flow chart for a small non-profit (Sauti Salama, a survivor-led organisation in Kenya working on gender-based violence). Reply with ONE JSON object: {"title": string, "nodes": [{"id": string, "label": string, "kind": "start"|"step"|"decision"|"end"}], "edges": [{"from": string, "to": string, "label": string}]}. Rules: at most 14 nodes unless the text clearly has more; "id" is a short unique code such as n1, n2; "label" is under 9 words, in the language of the description; a "decision" is a question and each of its outgoing edges has a short label such as Yes or No; ordinary edges have an empty label; exactly one "start"; every node can be reached from the start; end every path in an "end" node. Use only the steps, people and rules in the description; never add steps, names, numbers or rules it does not contain. Never include a survivor's personal details.`;

/** A flow from a description, or from the text of a document or sheet that describes a process. */
export async function designFlowFromText(prompt: string, source = ''): Promise<FlowGraph> {
  const user = `${prompt.trim() ? `What to draw: ${prompt.trim().slice(0, 1500)}\n\n` : ''}${source.trim() ? `Text to draw it from:\n${source.trim().slice(0, 9000)}` : ''}`;
  const raw = await askAi(SYSTEM, user, 1800, { json: true, temperature: 0.2 });
  let parsed: unknown = {};
  try { parsed = JSON.parse(raw); } catch { const m = /\{[\s\S]*\}/.exec(raw); if (m) { try { parsed = JSON.parse(m[0]); } catch { /* unreadable */ } } }
  const g = cleanGraph(parsed);
  if (g.nodes.length < 2) throw new Error('I could not draw a flow from that. Describe the steps in order, or paste the text of the process.');
  return g;
}

/** A short name for a flow or document from what it says; null when there is too little to go on. */
export async function nameFromText(kind: 'flow' | 'document', text: string, fallback: string | null = null): Promise<string | null> {
  const body = text.replace(/\s+/g, ' ').trim();
  if (body.split(' ').length < 4) return fallback;
  try {
    const out = await askAi(
      `You name a ${kind} in a small non-profit's workspace from its content. Reply with the name only: two to six words, Title Case is not needed, no quotes, no file extension, no date, no generic words like "Untitled" or "Document". Use only what the content says; never include a survivor's name or any personal detail.`,
      body.slice(0, 3500),
      30,
      { temperature: 0.2 },
    );
    const name = out.replace(/["'`]/g, '').replace(/\.[a-z]{2,5}$/i, '').replace(/[\\/:*?<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    return name.length >= 3 ? name : fallback;
  } catch {
    return fallback;
  }
}
