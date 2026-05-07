-- journals: V0.2 일기 (1인 1날짜 = 1로우)
-- 셋업 옵션: auto-expose OFF (수동 grant), auto-RLS ON (alter ... enable 불필요)

create table journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  date date not null,
  content text not null default '',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, date)
);

create index journals_user_date_idx on journals (user_id, date desc);

grant select, insert, update, delete on journals to authenticated;

create policy journals_owner on journals
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger journals_set_updated_at
  before update on journals
  for each row execute function set_updated_at();
