-- The grant agent: what a funder asks for (read from its call or its documents) and the application drafted for it,
-- one brief per grant or opportunity. Feedback from the funder is kept so the next application to the same funder
-- is written with it in mind.
create table if not exists public.mjengo_grant_briefs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('grant', 'opportunity')),
  entity_id uuid not null,
  funder text,
  source_url text,
  -- {sections:[{id,title,guidance,wordLimit}], criteria:[{name,weight,description}], eligibility:[text], attachments:[text], notes:text}
  requirements jsonb not null default '{}'::jsonb,
  -- {<sectionId>: {text, updatedAt}}
  drafts jsonb not null default '{}'::jsonb,
  -- the last review: {at, overall, criteria:[{name,score,max,feedback}], checks:[{ok,text}]}
  review jsonb,
  funder_feedback text,
  read_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id)
);
create index if not exists mjengo_grant_briefs_funder_idx on public.mjengo_grant_briefs (lower(funder));
alter table public.mjengo_grant_briefs enable row level security;
