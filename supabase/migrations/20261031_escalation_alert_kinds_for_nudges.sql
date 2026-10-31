-- The escalation ledger also records the provider nudge (half the window) and the survivor follow-up, once each.
ALTER TABLE public.case_escalation_alerts DROP CONSTRAINT IF EXISTS case_escalation_alerts_kind_check;
ALTER TABLE public.case_escalation_alerts ADD CONSTRAINT case_escalation_alerts_kind_check CHECK (kind IN ('unmatched_report', 'inactive_match', 'provider_nudge', 'survivor_followup'));
