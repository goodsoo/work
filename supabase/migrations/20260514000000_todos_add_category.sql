-- todos: 아카이빙 카테고리 (업무, 미팅, 없음 등)
alter table todos
  add column category text default null
  check (category is null or category in ('work', 'meeting', 'etc'));

-- linked_meeting_id 가 있으면 자동으로 'meeting' 카테고리
update todos set category = 'meeting' where linked_meeting_id is not null and category is null;
