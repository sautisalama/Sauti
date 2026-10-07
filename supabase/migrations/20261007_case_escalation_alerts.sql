-- Ledger of urgent escalation emails so each stale case is escalated once.
-- Written only by the service role (cron); RLS is on with no policies, so
-- anon/authenticated clients cannot read or write it.
CREATE TABLE IF NOT EXISTS public.case_escalation_alerts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       text NOT NULL CHECK (kind IN ('unmatched_report', 'inactive_match')),
  ref_id     uuid NOT NULL,          -- reports.report_id or matched_services.id
  report_id  uuid,
  sent_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, ref_id)
);

ALTER TABLE public.case_escalation_alerts ENABLE ROW LEVEL SECURITY;
