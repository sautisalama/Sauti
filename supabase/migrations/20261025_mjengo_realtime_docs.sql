-- Co-editing in the document editor travels over private Realtime broadcast channels named
-- "mjengo-doc:<file id>". Only administrators may listen or send on them.
drop policy if exists "mjengo_doc_channels_read" on realtime.messages;
create policy "mjengo_doc_channels_read" on realtime.messages for select to authenticated
  using (realtime.topic() like 'mjengo-doc:%' and public.is_admin((select auth.uid())));
drop policy if exists "mjengo_doc_channels_write" on realtime.messages;
create policy "mjengo_doc_channels_write" on realtime.messages for insert to authenticated
  with check (realtime.topic() like 'mjengo-doc:%' and public.is_admin((select auth.uid())));
