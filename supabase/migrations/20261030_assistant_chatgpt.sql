-- Sign in with ChatGPT: the assistant can hold a ChatGPT sign-in as well as an API key.
alter table public.mjengo_ai_settings drop constraint if exists mjengo_ai_settings_provider_check;
alter table public.mjengo_ai_settings add constraint mjengo_ai_settings_provider_check check (provider in ('openrouter', 'openai', 'chatgpt'));
alter table public.mjengo_ai_settings add column if not exists chatgpt_client_id text;
alter table public.mjengo_ai_settings add column if not exists token_expires_at timestamptz;
alter table public.mjengo_ai_settings add column if not exists refresh_token_enc text;
