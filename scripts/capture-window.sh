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

# 제목에 의존하지 않고 "화면 앞에 있는 앱 창" 을 잡는다 (dev 창 제목이 "app" 으로
# 남는 환경 때문). 캡쳐할 창을 앞으로 가져온 뒤(클릭) 실행하면 그 창이 잡힌다.
if ! win_id="$(swift "$script_dir/find-window.swift" 2>/dev/null)"; then
  echo "✗ 앱 창을 찾지 못했습니다." >&2
  echo "  · dev 앱이 떠있는지 확인하세요 (bun run tauri:dev)." >&2
  echo "  · 캡쳐할 창을 화면 앞으로 가져온 뒤(클릭) 다시 실행하세요." >&2
  exit 1
fi

# screencapture 는 호출 프로세스에 화면 기록 권한이 필요. tmux 안에서 돌리면 권한
# 책임이 tmux 서버로 잡혀 막히는 경우가 많다(빈 파일/실패). 그 땐 권한 불필요한
# 네이티브 캡쳐 + import-screenshot.sh 경로로 안내.
if ! screencapture -l"$win_id" -o "$out" 2>/dev/null || [[ ! -s "$out" ]]; then
  rm -f "$out"
  echo "✗ 창 캡쳐 실패 — 화면 기록 권한 문제일 수 있습니다 (tmux 안이면 흔함)." >&2
  echo "  권한 없이 찍는 법: Cmd+Shift+4 → Space → 창 클릭 으로 찍은 뒤" >&2
  echo "    scripts/import-screenshot.sh $phase ${n:+$n}" >&2
  exit 1
fi
echo "$out"
