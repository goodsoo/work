# goodsoob-work vault

본인 업무 노트 vault. 모든 데이터는 md 파일.

## 구조

```
vault/
├── inbox.md           # 독립 todo + 빠른 메모 + 미래 일정
├── meetings/          # 회의록 (날짜-제목.md)
└── journals/          # 일기 (날짜.md)
```

## 규칙

- **할 일**: 어디서든 `- [ ]` 체크박스. 날짜 있으면 `— YYYY-MM-DD` 또는 `— M/D`. vault 전체 스캔으로 "할 일" 페이지에 모임.
- **태그**: `#work`, `#meeting`, `#personal`, `#event` 등 자유.
- **담당자**: `[이름]` 접두로 표기 (회의 action item 형식).
- **Frontmatter**: 회의록/일기 메타데이터. YAML.

## 외부 도구 호환

- 옵시디안: vault 폴더 그대로 열면 됨. Tasks 플러그인 호환.
- 회사 공유: 회의록 1개 = 1개 md 파일. 그대로 첨부/복사.
- 백업: vault 폴더를 git 또는 iCloud에.
