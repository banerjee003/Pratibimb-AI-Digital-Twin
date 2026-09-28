create table if not exists public.personas (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    tone text not null default 'casual',
    style text not null default 'friendly, direct, concise',
    humor text not null default 'light',
    notes text not null default '',
    language text not null default 'en',
    photo_path text,
    voice_path text,
    created_at timestamptz not null default now()
);

create table if not exists public.messages (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    persona_id uuid not null references public.personas(id) on delete cascade,
    role text not null check (role in ('user','assistant')),
    content text not null,
    created_at timestamptz not null default now()
);

alter table public.personas enable row level security;
alter table public.messages enable row level security;

create policy "users manage own personas"
on public.personas for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users manage own messages"
on public.messages for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
