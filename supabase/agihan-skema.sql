-- =====================================================================
-- Agihan Guru Mata Pelajaran — skema Supabase (rujukan)
-- Projek: agihan-guru (https://upeohhckgenamwggajip.supabase.co)
-- Sudah dijalankan pada projek tersebut; fail ini untuk rujukan / pasang semula.
-- =====================================================================

create table public.settings (key text primary key, value text);

create table public.teachers (
  id bigint generated always as identity primary key,
  name text not null unique check (length(trim(name)) >= 3),
  bil int,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.subjects (
  code text primary key,
  title text not null,
  name text not null,
  sort int not null default 0,
  waktu_t1 numeric not null default 0,   -- waktu seminggu setiap kelas Tahap 1
  waktu_t2 numeric not null default 0,   -- waktu seminggu setiap kelas Tahap 2
  per_slot numeric,                      -- jika diisi: setiap slot = N waktu (kolaborasi)
  parts jsonb                            -- pecahan untuk eksport aSc (cth PI + Tasmik)
);

create table public.classes (
  name text primary key,
  tahun int not null check (tahun between 1 and 6),
  tahap int generated always as (case when tahun <= 3 then 1 else 2 end) stored,
  sort int not null default 0,
  guru_kelas_id bigint references public.teachers(id) on delete set null,
  updated_at timestamptz,
  updated_by text
);

create table public.allocations (
  id bigint generated always as identity primary key,
  subject_code text not null references public.subjects(code) on update cascade on delete cascade,
  class_name text not null references public.classes(name) on update cascade on delete cascade,
  slot int not null default 1,
  teacher_id bigint references public.teachers(id) on delete set null,
  updated_at timestamptz,
  updated_by text,
  unique (subject_code, class_name, slot)
);
create index allocations_teacher_idx on public.allocations(teacher_id);
create index allocations_class_idx on public.allocations(class_name);
create index classes_gk_idx on public.classes(guru_kelas_id);

create table public.editors (
  email text primary key check (email = lower(email)),
  nama text,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  by_email text, tbl text not null, row_ref text, label text, old_val text, new_val text
);
create index audit_log_at_idx on public.audit_log(at desc);

-- ---------- fungsi bantuan ----------
create schema if not exists private;

create or replace function private.is_editor()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.editors e
                 where e.email = lower(coalesce((select auth.jwt()) ->> 'email', '')));
$$;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_editor() to anon, authenticated;

create or replace function private.tname(p bigint)
returns text language sql stable security definer set search_path = ''
as $$ select name from public.teachers where id = p $$;

create or replace function private.audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare who text := (select auth.jwt()) ->> 'email';
begin
  if tg_table_name = 'allocations' then
    if new.teacher_id is distinct from old.teacher_id then
      insert into public.audit_log(by_email, tbl, row_ref, label, old_val, new_val)
      values (who, 'allocations', new.id::text, new.subject_code || ' ' || new.class_name || ' #' || new.slot,
              private.tname(old.teacher_id), private.tname(new.teacher_id));
    end if;
  elsif tg_table_name = 'classes' then
    if new.guru_kelas_id is distinct from old.guru_kelas_id then
      insert into public.audit_log(by_email, tbl, row_ref, label, old_val, new_val)
      values (who, 'classes', new.name, 'Guru Kelas ' || new.name,
              private.tname(old.guru_kelas_id), private.tname(new.guru_kelas_id));
    end if;
  elsif tg_table_name = 'teachers' then
    if tg_op = 'INSERT' then
      insert into public.audit_log(by_email, tbl, row_ref, label, old_val, new_val)
      values (who, 'teachers', new.id::text, 'Tambah guru', null, new.name);
    elsif new.name is distinct from old.name or new.aktif is distinct from old.aktif then
      insert into public.audit_log(by_email, tbl, row_ref, label, old_val, new_val)
      values (who, 'teachers', new.id::text, 'Kemas kini guru',
              old.name || case when old.aktif then '' else ' (tidak aktif)' end,
              new.name || case when new.aktif then '' else ' (tidak aktif)' end);
    end if;
  elsif tg_table_name = 'subjects' then
    if new.waktu_t1 is distinct from old.waktu_t1 or new.waktu_t2 is distinct from old.waktu_t2 then
      insert into public.audit_log(by_email, tbl, row_ref, label, old_val, new_val)
      values (who, 'subjects', new.code, 'Waktu ' || new.code,
              old.waktu_t1 || ' / ' || old.waktu_t2, new.waktu_t1 || ' / ' || new.waktu_t2);
    end if;
  end if;
  return new;
end $$;

create trigger audit_allocations after update on public.allocations for each row execute function private.audit();
create trigger audit_classes after update on public.classes for each row execute function private.audit();
create trigger audit_teachers after insert or update on public.teachers for each row execute function private.audit();
create trigger audit_subjects after update on public.subjects for each row execute function private.audit();

-- ---------- RLS ----------
alter table public.settings enable row level security;
alter table public.teachers enable row level security;
alter table public.subjects enable row level security;
alter table public.classes enable row level security;
alter table public.allocations enable row level security;
alter table public.editors enable row level security;
alter table public.audit_log enable row level security;

create policy "baca settings" on public.settings for select to anon, authenticated using (true);
create policy "baca teachers" on public.teachers for select to anon, authenticated using (true);
create policy "baca subjects" on public.subjects for select to anon, authenticated using (true);
create policy "baca classes" on public.classes for select to anon, authenticated using (true);
create policy "baca allocations" on public.allocations for select to anon, authenticated using (true);

create policy "editor ubah settings" on public.settings for update to authenticated using ((select private.is_editor())) with check ((select private.is_editor()));
create policy "editor tambah teachers" on public.teachers for insert to authenticated with check ((select private.is_editor()));
create policy "editor ubah teachers" on public.teachers for update to authenticated using ((select private.is_editor())) with check ((select private.is_editor()));
create policy "editor ubah subjects" on public.subjects for update to authenticated using ((select private.is_editor())) with check ((select private.is_editor()));
create policy "editor ubah classes" on public.classes for update to authenticated using ((select private.is_editor())) with check ((select private.is_editor()));
create policy "editor ubah allocations" on public.allocations for update to authenticated using ((select private.is_editor())) with check ((select private.is_editor()));

create policy "editor baca editors" on public.editors for select to authenticated
  using ((select private.is_editor()) or email = lower((select auth.jwt()) ->> 'email'));
create policy "editor tambah editors" on public.editors for insert to authenticated with check ((select private.is_editor()));
create policy "editor buang editors" on public.editors for delete to authenticated
  using ((select private.is_editor()) and email <> lower((select auth.jwt()) ->> 'email'));
create policy "editor baca log" on public.audit_log for select to authenticated using ((select private.is_editor()));

-- ---------- simpan berkelompok dengan semakan konflik ----------
create or replace function public.simpan_agihan(p_changes jsonb default '[]', p_guru_kelas jsonb default '[]')
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  c jsonb; who text := (select auth.jwt()) ->> 'email';
  saved jsonb := '[]'; conflicts jsonb := '[]'; cur bigint;
begin
  if not private.is_editor() then
    raise exception 'Akaun ini tiada kebenaran mengedit' using errcode = '42501';
  end if;
  for c in select * from jsonb_array_elements(coalesce(p_changes, '[]')) loop
    update public.allocations
       set teacher_id = (c->>'t')::bigint, updated_at = now(), updated_by = who
     where id = (c->>'id')::bigint and teacher_id is not distinct from (c->>'old')::bigint;
    if found then saved := saved || to_jsonb(c->>'id');
    else
      select teacher_id into cur from public.allocations where id = (c->>'id')::bigint;
      conflicts := conflicts || jsonb_build_object('id', c->>'id', 'current', cur);
    end if;
  end loop;
  for c in select * from jsonb_array_elements(coalesce(p_guru_kelas, '[]')) loop
    update public.classes
       set guru_kelas_id = (c->>'t')::bigint, updated_at = now(), updated_by = who
     where name = c->>'cls' and guru_kelas_id is not distinct from (c->>'old')::bigint;
    if found then saved := saved || to_jsonb('GK:' || (c->>'cls'));
    else
      select guru_kelas_id into cur from public.classes where name = c->>'cls';
      conflicts := conflicts || jsonb_build_object('id', 'GK:' || (c->>'cls'), 'current', cur);
    end if;
  end loop;
  return jsonb_build_object('saved', saved, 'conflicts', conflicts);
end $$;
revoke execute on function public.simpan_agihan(jsonb, jsonb) from public, anon;
grant execute on function public.simpan_agihan(jsonb, jsonb) to authenticated;

-- ---------- paparan untuk sistem lain (cth. Jana Jadual) ----------
create view public.v_agihan with (security_invoker = true) as
select a.id, s.code as subjek_kod, s.name as subjek, a.class_name as kelas, c.tahun, c.tahap, a.slot,
       t.id as guru_id, t.name as guru,
       coalesce(s.per_slot, case when c.tahap = 1 then s.waktu_t1 else s.waktu_t2 end) as waktu
from public.allocations a
join public.subjects s on s.code = a.subject_code
join public.classes c on c.name = a.class_name
left join public.teachers t on t.id = a.teacher_id;

-- =====================================================================
-- KEMAS KINI: peranan pengguna (admin / ketua_panitia / guru)
-- Menggantikan jadual editors. Baca wajib log masuk & berdaftar.
-- =====================================================================
create table public.pengguna (
  email text primary key check (email = lower(trim(email)) and email like '%@%'),
  nama text,
  peranan text not null default 'guru' check (peranan in ('admin', 'ketua_panitia', 'guru')),
  subjek text[] not null default '{}',          -- subjek panitia (ketua_panitia)
  teacher_id bigint references public.teachers(id) on delete set null,
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- private.peranan(), private.boleh_lihat(), private.is_admin(), private.boleh_edit_subjek(kod)
--   * baca settings/teachers/subjects/classes/allocations: boleh_lihat() (pengguna aktif)
--   * ubah allocations: boleh_edit_subjek(subject_code) — admin, atau ketua_panitia bagi subjek dalam pengguna.subjek
--   * ubah teachers/subjects/classes/settings, urus pengguna, baca audit_log: is_admin()
--   * trigger jaga_admin: mesti kekal sekurang-kurangnya seorang admin aktif
-- public.simpan_agihan(p_changes, p_guru_kelas) -> {saved, conflicts, ditolak}
-- public.agihan_untuk_jana() -> {agihan:[{kelas,tahun,subjek_kod,slot,guru,waktu}], guruKelas:[{kelas,guru}]}
--   (anon boleh panggil — untuk Jana Jadual; data sama seperti jadual waktu awam)
-- Definisi penuh: migration "peranan_pengguna" dalam projek agihan-guru.
