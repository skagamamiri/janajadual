-- =====================================================================
-- Jana Jadual (ICT HUB) — skema Supabase
-- Jalankan sekali dalam Supabase Dashboard > SQL Editor.
-- Selepas itu TUKAR kata laluan admin (lihat bahagian paling bawah).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Projek jadual (draf kerja). Satu baris = satu projek, data penuh dalam jsonb.
create table if not exists public.tt_projek (
  id           uuid primary key default gen_random_uuid(),
  nama         text not null,
  data         jsonb not null,
  dikemas_kini timestamptz not null default now()
);

-- Jadual yang telah diterbitkan, dalam format jadual.html ({teachers, classes}).
-- id = id versi (cth "v8"). jadual.html / jadual-push boleh membaca jadual ini.
create table if not exists public.tt_terbit (
  id        text primary key,
  label     text not null,
  projek_id uuid references public.tt_projek(id) on delete set null,
  data      jsonb not null,
  semasa    boolean not null default false,
  diterbit  timestamptz not null default now()
);

-- Kata laluan admin (hash bcrypt). Tiada polisi = tidak boleh dibaca dari luar.
create table if not exists public.tt_kunci (
  id   int primary key default 1 check (id = 1),
  hash text not null
);

alter table public.tt_projek enable row level security;
alter table public.tt_terbit enable row level security;
alter table public.tt_kunci  enable row level security;

drop policy if exists "tt_projek baca" on public.tt_projek;
create policy "tt_projek baca" on public.tt_projek for select using (true);
drop policy if exists "tt_terbit baca" on public.tt_terbit;
create policy "tt_terbit baca" on public.tt_terbit for select using (true);
-- Tiada polisi insert/update/delete: semua tulisan melalui fungsi di bawah sahaja.

create or replace function public.tt_sahkan(p_kunci text)
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select exists (select 1 from public.tt_kunci k where k.hash = crypt(p_kunci, k.hash));
$$;

create or replace function public.tt_simpan(p_kunci text, p_id uuid, p_nama text, p_data jsonb)
returns uuid language plpgsql security definer
set search_path = public, extensions as $$
declare v_id uuid;
begin
  if not public.tt_sahkan(p_kunci) then raise exception 'Kata laluan admin salah'; end if;
  if p_id is null then
    insert into public.tt_projek(nama, data) values (p_nama, p_data) returning id into v_id;
  else
    insert into public.tt_projek(id, nama, data, dikemas_kini) values (p_id, p_nama, p_data, now())
    on conflict (id) do update set nama = excluded.nama, data = excluded.data, dikemas_kini = now()
    returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.tt_padam(p_kunci text, p_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  if not public.tt_sahkan(p_kunci) then raise exception 'Kata laluan admin salah'; end if;
  delete from public.tt_projek where id = p_id;
end $$;

create or replace function public.tt_terbitkan(p_kunci text, p_id text, p_label text, p_projek uuid, p_data jsonb, p_semasa boolean)
returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  if not public.tt_sahkan(p_kunci) then raise exception 'Kata laluan admin salah'; end if;
  if p_semasa then update public.tt_terbit set semasa = false where semasa; end if;
  insert into public.tt_terbit(id, label, projek_id, data, semasa, diterbit)
  values (p_id, p_label, p_projek, p_data, p_semasa, now())
  on conflict (id) do update set label = excluded.label, projek_id = excluded.projek_id,
    data = excluded.data, semasa = excluded.semasa, diterbit = now();
end $$;

grant execute on function public.tt_sahkan(text) to anon, authenticated;
grant execute on function public.tt_simpan(text, uuid, text, jsonb) to anon, authenticated;
grant execute on function public.tt_padam(text, uuid) to anon, authenticated;
grant execute on function public.tt_terbitkan(text, text, text, uuid, jsonb, boolean) to anon, authenticated;

-- Kata laluan admin awal. TUKAR 'TukarSaya123' kepada kata laluan cikgu sendiri:
insert into public.tt_kunci(id, hash) values (1, crypt('TukarSaya123', gen_salt('bf')))
on conflict (id) do nothing;

-- Untuk menukar kata laluan kemudian:
-- update public.tt_kunci set hash = crypt('KataLaluanBaharu', gen_salt('bf')) where id = 1;
