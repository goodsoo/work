-- 회의 녹음을 외부 STT로 변환한 raw 텍스트.
-- 본문(content)은 본인이 회의 중 적은 정리 노트, transcript는 보조 source.
-- AI 요약은 둘 다 참고.
alter table meetings
  add column transcript text;
