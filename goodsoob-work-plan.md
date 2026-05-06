# goodsoob-work 프로젝트 기획안

> Claude Code에게 전달하는 프로젝트 기획 문서

---

## 개요

개인 업무 관리 PWA. 맥북과 아이폰에서 동일하게 사용.

- **사용자**: 1인 (본인만 사용)
- **접근 방식**: Google 로그인 1회 → 이후 자동 유지
- **모바일**: iPhone PWA (홈 화면 추가 후 앱처럼 사용)

---

## 핵심 기능

### 1. 회의록
- 제목 / 날짜 / 참석자 입력
- 본문 자유 입력 (안건, 논의내용, 결론 등)
- **AI 요약 버튼** → Claude가 회의 내용 자동 요약 + 액션아이템 추출
- **Notion 복사 버튼** → Markdown 포맷으로 클립보드 복사 (Notion에 붙여넣기 시 자동 렌더링)
- 회의록 목록 (최신순 정렬)

### 2. Todo 관리
- 할일 추가 / 완료 체크 / 삭제
- 우선순위 설정 (높음 / 보통 / 낮음)
- 기한(due date) 설정
- 완료 항목 숨기기/보기 토글

### 3. 스케줄
- 주간 캘린더 뷰 (모바일 기준 가로 스크롤)
- 일정 추가 / 시간 설정
- 기한이 있는 Todo는 캘린더에도 표시

---

## 화면 구조

탭 3개짜리 단일 페이지 앱 (SPA). 탭바는 하단 고정 (iPhone Safe Area 대응).

```
┌─────────────────────┐
│      콘텐츠 영역      │
│                     │
│                     │
├─────────────────────┤
│  회의록 │ 할일 │ 스케줄 │  ← 하단 탭바 고정
└─────────────────────┘
```

---

## 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | React 19 + TypeScript + Vite |
| 스타일 | Tailwind CSS v4 |
| 백엔드 / DB | Supabase (PostgreSQL) |
| 인증 | Supabase Auth — Google OAuth |
| AI 요약 | Anthropic Claude API (Supabase Edge Function 경유) |
| PWA | vite-plugin-pwa |
| 날짜 처리 | date-fns |

---

## 인증 방식

- Google OAuth 단일 로그인
- 로그인 후 세션 자동 유지 → 앱 열면 바로 사용
- 맥북 / 아이폰 모두 동일 Google 계정으로 데이터 공유

---

## DB 스키마

```sql
-- 회의록
create table meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  title text,
  date date,
  attendees text,
  content text,
  summary text,
  created_at timestamptz default now()
);

-- 할일
create table todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  title text,
  priority text default 'medium', -- high / medium / low
  due_date date,
  done boolean default false,
  created_at timestamptz default now()
);

-- 스케줄
create table schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  title text,
  start_time timestamptz,
  end_time timestamptz,
  linked_todo_id uuid references todos(id),
  created_at timestamptz default now()
);
```

---

## AI 요약 처리 방식

- Anthropic API 키는 클라이언트에 절대 노출 금지
- **Supabase Edge Function**을 프록시로 사용
  - 클라이언트 → Edge Function → Anthropic API 호출
- 요약 결과: 핵심 내용 3줄 + 액션아이템 목록

---

## PWA 설정 요구사항

- `manifest.json`: 앱 이름 / 아이콘 / 테마 컬러 설정
- `viewport`: iPhone Safe Area (`env(safe-area-inset-*)`) 대응
- 오프라인: UI는 캐싱, 데이터는 Supabase 연결 필요

---

## 환경변수 (.env)

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Anthropic API 키는 Supabase Edge Function 환경변수에만 설정 (클라이언트 미사용).

---

## 프로젝트 구조 (초안)

```
goodsoob-work/
├── public/
│   ├── icons/          # PWA 아이콘
│   └── manifest.json
├── src/
│   ├── api/
│   │   ├── meetings.ts
│   │   ├── todos.ts
│   │   └── schedules.ts
│   ├── components/
│   │   ├── meetings/
│   │   ├── todos/
│   │   └── schedules/
│   ├── pages/
│   │   ├── MeetingsPage.tsx
│   │   ├── TodosPage.tsx
│   │   └── SchedulesPage.tsx
│   ├── lib/
│   │   └── supabase.ts
│   ├── App.tsx
│   └── main.tsx
├── supabase/
│   └── functions/
│       └── summarize/  # Edge Function
├── CLAUDE.md
├── .env
└── vite.config.ts
```

---

## Claude Code 시작 프롬프트 예시

```
이 기획안을 바탕으로 goodsoob-work 프로젝트를 세팅해줘.

1. Vite + React + TypeScript 프로젝트 생성
2. Tailwind v4, Supabase, vite-plugin-pwa, date-fns 설치
3. 위 폴더 구조대로 파일 생성
4. Supabase 클라이언트 초기화 (lib/supabase.ts)
5. Google OAuth 로그인 흐름 구현
6. 하단 탭바 + 3개 페이지 기본 레이아웃 구현
```
