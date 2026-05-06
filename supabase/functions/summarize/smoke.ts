// Manual smoke test: deploy 후 1회 실행으로 happy path 검증.
// 사용:
//   SUMMARIZE_URL=https://<ref>.supabase.co/functions/v1/summarize \
//   SUPABASE_ANON_KEY=sb_publishable_xxx \
//   deno run --allow-env --allow-net supabase/functions/summarize/smoke.ts

const url = Deno.env.get("SUMMARIZE_URL");
const key = Deno.env.get("SUPABASE_ANON_KEY");

if (!url || !key) {
  console.error("Missing SUMMARIZE_URL or SUPABASE_ANON_KEY env.");
  Deno.exit(1);
}

const sample = {
  title: "제품 OKR 미팅",
  date: "2026-05-05",
  attendees: "김철수, 이영희",
  content: `김철수: 다음 분기 OKR 초안 검토합니다. KR1은 신규 사용자 +20%, KR2는 retention 30일 65%.
이영희: KR2 측정 기준이 명확해야 합니다. 활성 사용자 정의부터 정리하죠.
결정사항:
- KR1 그대로 유지.
- KR2 측정 기준 정의는 이영희가 다음 주 화요일까지 작성.
- 본 미팅은 다음 주 목요일 14시.`,
};

const t0 = performance.now();
const res = await fetch(url, {
  method: "POST",
  headers: {
    authorization: `Bearer ${key}`,
    apikey: key,
    "content-type": "application/json",
  },
  body: JSON.stringify(sample),
});

const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
const text = await res.text();
console.log(`HTTP ${res.status} (${elapsed}s)`);
console.log(text);

if (!res.ok) Deno.exit(2);

const body = JSON.parse(text);
if (typeof body.summary !== "string" || !Array.isArray(body.action_items)) {
  console.error("FAIL: invalid shape");
  Deno.exit(3);
}
if (body.summary.trim().length === 0) {
  console.error("FAIL: empty summary");
  Deno.exit(4);
}
console.log("\nOK — shape valid, summary non-empty.");
