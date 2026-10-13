-- Finance: invoices, receipts (with a photo or a file in Files), and reusable invoice and budget templates.
alter table public.mjengo_templates drop constraint if exists mjengo_templates_kind_check;
alter table public.mjengo_templates add constraint mjengo_templates_kind_check check (kind in ('document', 'post', 'design', 'invoice', 'budget'));

create table if not exists public.mjengo_invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  client_name text not null,
  client_email text,
  client_address text,
  issue_date date not null default current_date,
  due_date date,
  currency text not null default 'KES',
  items jsonb not null default '[]'::jsonb,
  tax_pct numeric not null default 0,
  notes text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),
  subtotal numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  paid_at timestamptz,
  project_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists mjengo_invoices_number_idx on public.mjengo_invoices (number);
alter table public.mjengo_invoices enable row level security;

create table if not exists public.mjengo_receipts (
  id uuid primary key default gen_random_uuid(),
  vendor text not null,
  amount numeric not null default 0,
  currency text not null default 'KES',
  spent_on date not null default current_date,
  category text,
  note text,
  file_id uuid references public.vault_files(id) on delete set null,
  project_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists mjengo_receipts_date_idx on public.mjengo_receipts (spent_on desc);
alter table public.mjengo_receipts enable row level security;
