-- schedules: V0.3 일정
-- linked_todo_id로 due_date가 있는 Todo와 연결 가능 (V0.4+)

create table schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  start_time timestamptz not null,
  end_time timestamptz,
  linked_todo_id uuid references todos(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index schedules_user_start_idx on schedules (user_id, start_time);

grant select, insert, update, delete on schedules to authenticated;

create policy schedules_owner on schedules
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger schedules_set_updated_at
  before update on schedules
  for each row execute function set_updated_at();
