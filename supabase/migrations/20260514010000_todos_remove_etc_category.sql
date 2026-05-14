-- 기타 카테고리 삭제: etc → null 변환 + constraint 업데이트
update todos set category = null where category = 'etc';

alter table todos drop constraint if exists todos_category_check;
alter table todos add constraint todos_category_check
  check (category is null or category in ('work', 'meeting'));
