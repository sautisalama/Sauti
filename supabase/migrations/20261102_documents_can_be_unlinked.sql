-- Deleting a grant, opportunity, project or fellowship keeps the files its team made, because they can be reused.
-- Only the link is removed, so a document may now belong to no record.
alter table public.mjengo_documents alter column entity_type drop not null;
alter table public.mjengo_documents alter column entity_id drop not null;
