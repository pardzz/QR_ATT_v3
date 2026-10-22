-- QR-ATT schema. Run once in Supabase > SQL Editor.
create table public.profiles(id uuid primary key references auth.users on delete cascade,
 full_name text not null, id_no text, section text,
 role text not null default 'student' check(role in('student','teacher','admin')), created_at timestamptz default now());
create table public.events(id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(name) between 2 and 80), venue text not null, description text default '',
 starts_at timestamptz not null, status text not null default 'open' check(status in('open','closed')),
 created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade, created_at timestamptz default now());
create table public.event_secrets(event_id uuid primary key references public.events on delete cascade, token uuid not null default gen_random_uuid());
create table public.attendance(id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events on delete cascade, student_id uuid not null references public.profiles on delete cascade,
 status text not null default 'Present' check(status in('Present','Late','Absent')), created_at timestamptz default now(), unique(event_id,student_id));

create function public.my_role() returns text language sql security definer stable set search_path=public as $$select role from profiles where id=auth.uid()$$;

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id,full_name,id_no,section,role) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','User'),
 new.raw_user_meta_data->>'id_no',new.raw_user_meta_data->>'section',
 case when not exists(select 1 from profiles) then 'admin' when new.raw_user_meta_data->>'role'='teacher' then 'teacher' else 'student' end);
 return new; end$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.new_event_secret() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into event_secrets(event_id) values(new.id); return new; end$$;
create trigger on_event_created after insert on public.events for each row execute function public.new_event_secret();

create function public.record_attendance(p_code text) returns text language plpgsql security definer set search_path=public as $$
declare p text[]; e events%rowtype; st text;
begin
 if my_role() is distinct from 'student' then return 'forbidden'; end if;
 p:=regexp_match(p_code,'^QRATT:([0-9a-f-]{36}):([0-9a-f-]{36})$');
 if p is null then return 'invalid'; end if;
 select ev.* into e from events ev join event_secrets s on s.event_id=ev.id where ev.id=p[1]::uuid and s.token=p[2]::uuid;
 if not found then return 'invalid'; end if;
 if e.status<>'open' then return 'closed'; end if;
 st:=case when now()>e.starts_at+interval '15 minutes' then 'Late' else 'Present' end;
 begin insert into attendance(event_id,student_id,status) values(e.id,auth.uid(),st);
 exception when unique_violation then return 'duplicate'; end;
 return case when st='Late' then 'late' else 'ok' end;
end$$;
revoke execute on function public.record_attendance(text) from public,anon;
grant execute on function public.record_attendance(text) to authenticated;

alter table profiles enable row level security; alter table events enable row level security;
alter table event_secrets enable row level security; alter table attendance enable row level security;

create policy p_sel on profiles for select to authenticated using(id=auth.uid() or my_role() in('admin','teacher'));
create policy p_upd on profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid() and role=my_role());
create policy p_adm on profiles for update to authenticated using(my_role()='admin') with check(my_role()='admin');
create policy e_sel on events for select to authenticated using(true);
create policy e_ins on events for insert to authenticated with check(my_role() in('teacher','admin') and created_by=auth.uid());
create policy e_upd on events for update to authenticated using(created_by=auth.uid() or my_role()='admin');
create policy e_del on events for delete to authenticated using(created_by=auth.uid() or my_role()='admin');
create policy s_sel on event_secrets for select to authenticated using(my_role()='admin' or exists(select 1 from events e where e.id=event_id and e.created_by=auth.uid()));
create policy a_sel on attendance for select to authenticated using(student_id=auth.uid() or my_role()='admin' or exists(select 1 from events e where e.id=event_id and e.created_by=auth.uid()));
create policy a_upd on attendance for update to authenticated using(my_role()='admin');
create policy a_del on attendance for delete to authenticated using(my_role()='admin');
