// Supabase Edge Function: summarize
// 입력: 회의록 텍스트 → Anthropic Claude tool_use로 {discussion_items, decisions, action_items} 추출.
// 환경변수 ANTHROPIC_API_KEY 필요.

// deno-lint-ignore-file no-explicit-any
import Anthropic from "npm:@anthropic-ai/sdk@0.39.0";

type SummarizeInput = {
  title?: string | null;
  date?: string | null;
  time?: string | null;
  attendees?: string | null;
  content: string;
};

type SummarizeOutput = {
  discussion_items: string[];
  decisions: string[];
  action_items: string[];
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const tool = {
  name: "record_meeting_summary",
  description:
    "회의 본문에서 논의 사항 / 결정 사항 / 액션 아이템을 분리 추출한다. 항상 한국어. 모든 항목은 한 줄~두 줄을 절대 초과하지 않으며, 산문이 아닌 압축된 불릿 한 줄로만 작성한다.",
  input_schema: {
    type: "object",
    properties: {
      discussion_items: {
        type: "array",
        items: { type: "string" },
        description:
          "회의에서 다룬 주제. 각 항목 형식 '[주제]: 한 줄 설명'. 결정 안 됐어도 OK. 본문에 없는 내용은 추측 금지.",
      },
      decisions: {
        type: "array",
        items: { type: "string" },
        description:
          "회의에서 합의되거나 확정된 것만. 논의 중인 건 절대 포함 금지. 한 줄로 압축. 결정된 게 없으면 빈 배열.",
      },
      action_items: {
        type: "array",
        items: { type: "string" },
        description:
          "담당자와 기한이 명시된 할 일. 형식 '[담당자] 할 일 — 기한'. 담당자가 본문에 없으면 그 항목 자체를 빼지 말고 '[미정]'으로. 기한이 본문에 없으면 '기한 미정'으로 명시. 액션 없으면 빈 배열.",
      },
    },
    required: ["discussion_items", "decisions", "action_items"],
  },
} as const;

const SYSTEM_PROMPT = `당신은 회의록 어시스턴트입니다. 회의 본문을 받아 한국어로 논의 사항 / 결정 사항 / 액션 아이템을 분리 추출합니다.

핵심 원칙 (반드시 지킴):
- 각 항목은 한 줄~두 줄. 길어지면 압축한다. 회의록은 길수록 안 읽힙니다.
- 산문 금지. 항상 압축된 불릿 한 줄.
- 본문에 없는 내용은 절대 추측하지 않습니다.

분리 규칙:
- 논의 사항(discussion_items): 회의에서 다룬 주제. 결정 여부 무관. 형식 '[주제]: 설명'.
- 결정 사항(decisions): 합의 / 확정된 것만. 논의만 됐고 미확정이면 절대 결정 사항에 넣지 않습니다.
- 액션 아이템(action_items): 담당자 + 기한이 있는 할 일. 형식 '[담당자] 할 일 — 기한'. 담당자/기한이 명시 안 되면 '[미정]', '기한 미정' 으로 라도 적습니다.

반드시 record_meeting_summary 도구로만 응답합니다.`;

function buildUserPrompt(input: SummarizeInput): string {
  const meta: string[] = [];
  if (input.title) meta.push(`제목: ${input.title}`);
  if (input.date) {
    const datePart = input.time ? `${input.date} ${input.time}` : input.date;
    meta.push(`일시: ${datePart}`);
  }
  if (input.attendees) meta.push(`참석: ${input.attendees}`);
  const header = meta.length > 0 ? meta.join("\n") + "\n\n" : "";
  return `${header}본문:\n${input.content}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "missing_api_key" }, 500);

  let body: SummarizeInput;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (
    !body?.content ||
    typeof body.content !== "string" ||
    body.content.trim().length === 0
  ) {
    return json({ error: "empty_content" }, 400);
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [tool as any],
      tool_choice: { type: "tool", name: tool.name } as any,
      messages: [{ role: "user", content: buildUserPrompt(body) }],
    });

    const block = response.content.find((b: any) => b.type === "tool_use") as
      | { type: "tool_use"; input: SummarizeOutput }
      | undefined;

    if (!block) {
      return json({ error: "no_tool_use" }, 502);
    }
    const out = block.input;
    if (
      !Array.isArray(out?.discussion_items) ||
      !Array.isArray(out?.decisions) ||
      !Array.isArray(out?.action_items)
    ) {
      return json({ error: "invalid_tool_output" }, 502);
    }

    const sanitize = (arr: unknown[]): string[] =>
      arr
        .filter((s: unknown): s is string => typeof s === "string")
        .map((s: string) => s.trim())
        .filter(Boolean);

    const result: SummarizeOutput = {
      discussion_items: sanitize(out.discussion_items),
      decisions: sanitize(out.decisions),
      action_items: sanitize(out.action_items),
    };
    return json(result, 200);
  } catch (e: any) {
    const message = e?.message ?? String(e);
    const status = typeof e?.status === "number" ? e.status : 500;
    return json(
      { error: "anthropic_error", message },
      status >= 400 && status < 600 ? status : 502
    );
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
