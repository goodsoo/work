-- meetings 스키마 v2: 회의록 포맷 spec 반영
-- - summary text 제거 (대신 discussion_items + decisions로 분리)
-- - time text 추가 (자유 입력 "14:00" 또는 "오후 2:20")
-- - discussion_items jsonb 추가 (string[])
-- - decisions jsonb 추가 (string[])
-- action_items는 그대로. 포맷만 바뀜 ("[담당자] 할 일 — 기한").

alter table meetings drop column if exists summary;
alter table meetings add column if not exists time text;
alter table meetings add column if not exists discussion_items jsonb;
alter table meetings add column if not exists decisions jsonb;
