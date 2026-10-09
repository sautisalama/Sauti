import { looseAdmin } from '@/lib/loose-db';

export interface AuditEntry {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  details?: Record<string, unknown>;
}

/**
 * Record who did what. Never throws: an audit write failing must not block the action itself,
 * but it is logged loudly so it can be noticed.
 */
export async function logAudit(e: AuditEntry): Promise<void> {
  try {
    const { error } = await looseAdmin().from('audit_logs').insert({
      actor_id: e.actorId ?? null,
      actor_email: e.actorEmail ?? null,
      action: e.action,
      target_type: e.targetType ?? null,
      target_id: e.targetId ?? null,
      target_label: e.targetLabel ?? null,
      details: e.details ?? {},
    });
    if (error) console.error('[audit] write failed:', error.message);
  } catch (err) {
    console.error('[audit] write failed:', err instanceof Error ? err.message : err);
  }
}
