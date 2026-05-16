-- meetings soft delete: deleted_at 컬럼 + 부분 index
-- 활성 메모만 조회되도록 list query는 deleted_at is null 필터를 추가.

alter table meetings add column if not exists deleted_at timestamptz;

-- 활성 메모 list query 최적화 (대부분의 read는 deleted_at is null)
create index if not exists meetings_user_active_idx
  on meetings (user_id, date desc)
  where deleted_at is null;

-- 휴지통 뷰 (deleted_at 내림차순)
create index if not exists meetings_user_deleted_idx
  on meetings (user_id, deleted_at desc)
  where deleted_at is not null;
