/**
 * The shape of a flow, free of any server code so the drawing board can use it: laying a graph out as Excalidraw shapes,
 * reading the steps back from a drawing, and turning a list of steps in a sheet into a graph.
 */

export type FlowNodeKind = 'start' | 'step' | 'decision' | 'end';
export interface FlowNode { id: string; label: string; kind: FlowNodeKind }
export interface FlowEdge { from: string; to: string; label?: string }
export interface FlowGraph { title: string; nodes: FlowNode[]; edges: FlowEdge[] }

/** The depth of each node counted from the start along the forward edges (loops back are ignored). */
export function layers(g: FlowGraph): Map<string, number> {
  const out = new Map<string, string[]>();
  const incoming = new Map<string, number>();
  for (const n of g.nodes) { out.set(n.id, []); incoming.set(n.id, 0); }
  for (const e of g.edges) { out.get(e.from)?.push(e.to); incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1); }
  const depth = new Map<string, number>();
  const onPath = new Set<string>();
  const visit = (id: string, d: number) => {
    if (onPath.has(id)) return; // a loop back: not counted
    if ((depth.get(id) ?? -1) >= d) return;
    depth.set(id, d);
    onPath.add(id);
    for (const t of out.get(id) ?? []) visit(t, d + 1);
    onPath.delete(id);
  };
  const roots = g.nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0 || n.kind === 'start');
  for (const r of roots.length ? roots : g.nodes.slice(0, 1)) visit(r.id, 0);
  for (const n of g.nodes) if (!depth.has(n.id)) visit(n.id, 0);
  return depth;
}

const W = 200, H = 70, DW = 230, DH = 120, GAP_X = 70, GAP_Y = 90;

/** Excalidraw "skeleton" elements for a graph, laid out top to bottom, with the arrows bound to their shapes. */
export function toSkeletons(g: FlowGraph, origin = { x: 0, y: 0 }): Record<string, unknown>[] {
  const depth = layers(g);
  const rows = new Map<number, FlowNode[]>();
  for (const n of g.nodes) { const d = depth.get(n.id) ?? 0; rows.set(d, [...(rows.get(d) ?? []), n]); }
  const widest = Math.max(...[...rows.values()].map((r) => r.reduce((w, n) => w + (n.kind === 'decision' ? DW : W) + GAP_X, -GAP_X)), W);
  const pos = new Map<string, { x: number; y: number; w: number; h: number }>();
  let y = origin.y;
  for (const d of [...rows.keys()].sort((a, b) => a - b)) {
    const row = rows.get(d)!;
    const rowH = Math.max(...row.map((n) => (n.kind === 'decision' ? DH : H)));
    const rowW = row.reduce((w, n) => w + (n.kind === 'decision' ? DW : W) + GAP_X, -GAP_X);
    let x = origin.x + (widest - rowW) / 2;
    for (const n of row) {
      const w = n.kind === 'decision' ? DW : W, h = n.kind === 'decision' ? DH : H;
      pos.set(n.id, { x, y: y + (rowH - h) / 2, w, h });
      x += w + GAP_X;
    }
    y += rowH + GAP_Y;
  }
  const shape = (k: FlowNodeKind) => (k === 'decision' ? 'diamond' : k === 'step' ? 'rectangle' : 'ellipse');
  const fill = (k: FlowNodeKind) => (k === 'start' ? '#d3f9d8' : k === 'end' ? '#ffe3e3' : k === 'decision' ? '#fff3bf' : '#d0ebff');
  const stroke = (k: FlowNodeKind) => (k === 'start' ? '#2f9e44' : k === 'end' ? '#e03131' : k === 'decision' ? '#f08c00' : '#1971c2');
  const out: Record<string, unknown>[] = g.nodes.map((n) => {
    const p = pos.get(n.id)!;
    return {
      type: shape(n.kind), id: `flow-${n.id}`, x: p.x, y: p.y, width: p.w, height: p.h,
      backgroundColor: fill(n.kind), strokeColor: stroke(n.kind), fillStyle: 'solid', roundness: n.kind === 'step' ? { type: 3 } : undefined,
      label: { text: n.label, fontSize: 18, strokeColor: '#1e1e1e' },
    };
  });
  for (const e of g.edges) {
    const a = pos.get(e.from), b = pos.get(e.to);
    if (!a || !b) continue;
    const back = b.y <= a.y; // a loop back to an earlier step
    out.push({
      type: 'arrow', id: `flow-${e.from}-${e.to}`,
      x: a.x + a.w / 2, y: a.y + a.h, width: b.x + b.w / 2 - (a.x + a.w / 2), height: b.y - (a.y + a.h),
      start: { id: `flow-${e.from}` }, end: { id: `flow-${e.to}` }, endArrowhead: 'arrow',
      strokeColor: back ? '#868e96' : '#1e1e1e', strokeStyle: back ? 'dashed' : 'solid',
      ...(e.label ? { label: { text: e.label, fontSize: 16 } } : {}),
    });
  }
  return out;
}

type El = { id: string; type: string; isDeleted?: boolean; text?: string; containerId?: string | null; startBinding?: { elementId: string } | null; endBinding?: { elementId: string } | null };

/** The steps and connections drawn on a board: shapes with their words, and arrows that join two of them. */
export function sceneToGraph(elements: readonly unknown[]): FlowGraph {
  const els = (elements as El[]).filter((e) => !e.isDeleted);
  const label = new Map<string, string>();
  for (const t of els) if (t.type === 'text' && t.containerId && t.text) label.set(t.containerId, t.text.replace(/\s+/g, ' ').trim());
  const shapes = els.filter((e) => ['rectangle', 'diamond', 'ellipse'].includes(e.type) && label.get(e.id));
  const ids = new Set(shapes.map((s) => s.id));
  const nodes: FlowNode[] = shapes.map((s) => ({ id: s.id, label: label.get(s.id)!, kind: s.type === 'diamond' ? 'decision' : 'step' }));
  const edges: FlowEdge[] = [];
  for (const a of els) {
    if (a.type !== 'arrow' || !a.startBinding || !a.endBinding) continue;
    const from = a.startBinding.elementId, to = a.endBinding.elementId;
    if (!ids.has(from) || !ids.has(to) || from === to) continue;
    const text = label.get(a.id);
    edges.push(text ? { from, to, label: text } : { from, to });
  }
  const hasIn = new Set(edges.map((e) => e.to)), hasOut = new Set(edges.map((e) => e.from));
  for (const n of nodes) {
    if (n.kind === 'decision') continue;
    if (!hasIn.has(n.id) && hasOut.has(n.id)) n.kind = 'start';
    else if (hasIn.has(n.id) && !hasOut.has(n.id)) n.kind = 'end';
  }
  return { title: '', nodes, edges };
}

/** Rows for the spreadsheet: steps in the order the flow runs, and where each leads. */
export function graphToRows(g: FlowGraph): { step: number; label: string; kind: string; next: string; condition: string }[] {
  const depth = layers(g);
  const order = [...g.nodes].sort((a, b) => (depth.get(a.id) ?? 0) - (depth.get(b.id) ?? 0));
  const num = new Map(order.map((n, i) => [n.id, i + 1]));
  const name = new Map(g.nodes.map((n) => [n.id, n.label]));
  return order.map((n) => {
    const out = g.edges.filter((e) => e.from === n.id);
    return {
      step: num.get(n.id)!, label: n.label, kind: n.kind,
      next: out.map((e) => `${num.get(e.to)}. ${name.get(e.to)}`).join('; '),
      condition: out.map((e) => e.label ?? '').filter(Boolean).join('; '),
    };
  });
}

/**
 * A process written as a table (a "Step" column, optionally "Next"/"Then"/"Leads to" and "Condition"/"Decision"): a graph
 * without any guessing. Returns null when the sheet does not look like a list of steps, so the AI can read it instead.
 */
export function sheetToGraph(rows: unknown[][], title = ''): FlowGraph | null {
  if (rows.length < 3) return null;
  const head = rows[0].map((h) => String(h ?? '').trim().toLowerCase());
  const col = (re: RegExp) => head.findIndex((h) => re.test(h));
  const stepCol = col(/^(step|task|activity|action|process|stage|what happens)\b/);
  if (stepCol < 0) return null;
  const nextCol = col(/^(next|then|leads to|goes to|go to|after)\b/);
  const typeCol = col(/^(type|kind|shape)\b/);
  const condCol = col(/^(condition|decision|if|answer)\b/);
  const numCol = col(/^(no\.?|#|number|id)$/);
  const body = rows.slice(1).filter((r) => String(r[stepCol] ?? '').trim());
  if (body.length < 2) return null;
  const nodes: FlowNode[] = body.map((r, i) => {
    const t = typeCol >= 0 ? String(r[typeCol] ?? '').toLowerCase() : '';
    const label = String(r[stepCol]).replace(/\s+/g, ' ').trim().slice(0, 70);
    const kind: FlowNodeKind = /decision|question|\?$/.test(t) || label.endsWith('?') ? 'decision' : /start|begin/.test(t) ? 'start' : /end|finish|stop/.test(t) ? 'end' : 'step';
    return { id: `n${i + 1}`, label, kind };
  });
  const byNumber = new Map<string, string>();
  body.forEach((r, i) => { byNumber.set(String(numCol >= 0 ? r[numCol] : i + 1).trim(), `n${i + 1}`); });
  const byLabel = new Map(nodes.map((n) => [n.label.toLowerCase(), n.id]));
  const edges: FlowEdge[] = [];
  body.forEach((r, i) => {
    const from = `n${i + 1}`;
    const cond = condCol >= 0 ? String(r[condCol] ?? '').split(/[;,]/).map((s) => s.trim()) : [];
    if (nextCol >= 0) {
      String(r[nextCol] ?? '').split(/[;,]/).map((s) => s.trim()).filter(Boolean).forEach((ref, k) => {
        const to = byNumber.get(ref.replace(/\D+.*$/, '') || ref) ?? byNumber.get(ref) ?? byLabel.get(ref.replace(/^\d+\.\s*/, '').toLowerCase());
        if (to && to !== from) edges.push(cond[k] ? { from, to, label: cond[k].slice(0, 30) } : { from, to });
      });
    } else if (i < body.length - 1) {
      edges.push({ from, to: `n${i + 2}` });
    }
  });
  if (!edges.length) return null;
  return { title, nodes, edges };
}
