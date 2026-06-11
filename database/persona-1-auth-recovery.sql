create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null references public.usuarios (id) on delete cascade,
  "tokenHash" text not null,
  "expiresAt" timestamptz not null,
  "consumedAt" timestamptz null,
  "createdAt" timestamptz not null default now()
);

create index if not exists password_reset_tokens_user_id_idx
  on public.password_reset_tokens ("userId");

create index if not exists password_reset_tokens_expires_at_idx
  on public.password_reset_tokens ("expiresAt");
