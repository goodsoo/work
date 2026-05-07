-- todos: V0.3 할 일
-- linked_meeting_id 컬럼은 V0.4 (액션아이템 → Todo 1-click)에서 사용

create table todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  linked_meeting_id uuid references meetings(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 가장 잦은 쿼리: 미완료 + due_date 가까운 순
create index todos_user_pending_due_idx
  on todos (user_id, done, due_date asc nulls last);

-- 캘린더 타임라인: 특정 날짜의 todos
create index todos_user_due_idx
  on todos (user_id, due_date)
  where due_date is not null;

grant select, insert, update, delete on todos to authenticated;

create policy todos_owner on todos
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger todos_set_updated_at
  before update on todos
  for each row execute function set_updated_at();
