-- meetings: V0.1 회의록 테이블
-- 셋업 옵션: auto-expose OFF (수동 grant), auto-RLS ON (alter ... enable 불필요)
-- design doc: ham-no-git-design-20260506-161246.md (line 112-129)

create table meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text,
  date date,
  attendees text,
  content text,
  summary text,
  action_items jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index meetings_user_date_idx on meetings (user_id, date desc);

-- auto-expose OFF이라 명시 grant 필요 (Data API에서 보이게)
grant select, insert, update, delete on meetings to authenticated;

-- auto-RLS ON이라 enable는 자동, policy만 추가
create policy meetings_owner on meetings
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- updated_at 자동 갱신 trigger
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger meetings_set_updated_at
  before update on meetings
  for each row execute function set_updated_at();
