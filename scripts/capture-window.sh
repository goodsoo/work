#!/usr/bin/env bash
# goodsoob-work dev 창을 자동으로 찾아 캡쳐한다 — takeoff/start 의 BEFORE/AFTER 스크린샷용.
# 기존 `screencapture -iW`(사용자가 창 클릭)를 대체: 창을 제목으로 찾아 `-l<windowID>` 로
# 직접 잡으므로 클릭이 필요 없고, 다른 Space/최소화 상태여도 잡힌다.
#
# 저장 규칙은 takeoff 와 동일: ~/Screenshots/{repo}/{slug}-{phase}-{n}.png
#   repo = main repo 폴더명 (worktree suffix 무시)
#   slug = 브랜치명의 마지막 segment (feat/foo-bar → foo-bar)
#
# 사용:
#   scripts/capture-window.sh before        # 다음 빈 번호로 BEFORE
#   scripts/capture-window.sh after 2        # AFTER 2번으로 명시
#
# 요구: macOS 화면 기록 권한 (screencapture / 창 제목 조회 공통, 터미널에 1회 부여).

set -euo pipefail

phase="${1:-}"
if [[ "$phase" != "before" && "$phase" != "after" ]]; then
  echo "사용법: $(basename "$0") <before|after> [n]" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# repo 명 = main repo 폴더명 (git-common-dir 의 부모). worktree 에서도 main 명으로 통일.
# git-common-dir 는 main repo 루트에선 상대경로(.git)를 반환하므로 절대경로화한다.
common_dir="$(cd "$(git rev-parse --git-common-dir)" && pwd)"
repo_name="$(basename "$(dirname "$common_dir")")"

branch="$(git rev-parse --abbrev-ref HEAD)"
slug="${branch##*/}"  # feat/foo-bar → foo-bar

dir="$HOME/Screenshots/$repo_name"
mkdir -p "$dir"

n="${2:-}"
if [[ -z "$n" ]]; then
  n=1
  while [[ -e "$dir/$slug-$phase-$n.png" ]]; do n=$((n + 1)); done
fi
out="$dir/$slug-$phase-$n.png"

# 창 제목 = 앱이 부팅 시 setTitle 한 값 (applyDevWindowTitle). 못 찾으면 finder 가
# 앱 창 1개 fallback 으로 처리하고, 여러 개 + 제목 매칭 실패면 비어 나온다.
title="짱수 · $branch"
if ! win_id="$(swift "$script_dir/find-window.swift" "$title" 2>/dev/null)"; then
  echo "✗ 창을 찾지 못했습니다." >&2
  echo "  · dev 앱이 떠있는지 확인하세요 (bun run tauri:dev)." >&2
  echo "  · 세션 창이 여러 개면 각 창 제목이 '짱수 · {브랜치}' 여야 구분됩니다" >&2
  echo "    (최신 코드로 dev 를 다시 띄우면 제목이 자동으로 박힙니다)." >&2
  exit 1
fi

screencapture -l"$win_id" -o "$out"
echo "$out"
