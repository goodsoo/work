#!/usr/bin/env bash
# 네이티브 스크린샷(Cmd+Shift+4 → Space → 창 클릭 등)으로 찍은 최신 파일을
# takeoff 슬러그 경로로 옮긴다. screencapture 프로그래매틱 캡쳐(capture-window.sh)가
# 화면 기록 권한에 막히는 환경(tmux 안에서 실행 → 권한 책임이 tmux 서버로 잡혀 터미널
# 권한이 안 먹음)에서 권한 없이 동작하는 캡쳐 경로 — OS 단축키로 찍고 이 스크립트로 파일링.
#
# 저장 규칙은 capture-window.sh 와 동일: ~/Screenshots/{repo}/{slug}-{phase}-{n}.png
#   repo = main repo 폴더명 (worktree suffix 무시)
#   slug = 브랜치명의 마지막 segment (feat/foo-bar → foo-bar)
#
# 사용:
#   scripts/import-screenshot.sh after        # 최신 스크린샷 → 다음 빈 번호
#   scripts/import-screenshot.sh after 2       # 번호 명시
#
# 권한 불필요 — 캡쳐는 OS(WindowServer)가, 이 스크립트는 파일 이동만 한다.

set -euo pipefail

phase="${1:-}"
if [[ "$phase" != "before" && "$phase" != "after" ]]; then
  echo "사용법: $(basename "$0") <before|after> [n]" >&2
  exit 2
fi

# repo 명 = main repo 폴더명 (git-common-dir 의 부모). worktree 에서도 main 명으로 통일.
common_dir="$(cd "$(git rev-parse --git-common-dir)" && pwd)"
repo_name="$(basename "$(dirname "$common_dir")")"

branch="$(git rev-parse --abbrev-ref HEAD)"
slug="${branch##*/}"  # feat/foo-bar → foo-bar

# macOS 스크린샷 저장 위치. 미설정이면 ~/Desktop. 선행 ~ 는 $HOME 으로 펼침.
src_dir="$(defaults read com.apple.screencapture location 2>/dev/null || true)"
src_dir="${src_dir/#\~/$HOME}"
[[ -n "$src_dir" && -d "$src_dir" ]] || src_dir="$HOME/Desktop"

# 최근 10분 내 최신 png (오래된 무관 파일 오선택 방지). 파일명 공백 안전.
newest=""
while IFS= read -r -d '' f; do
  if [[ -z "$newest" || "$f" -nt "$newest" ]]; then newest="$f"; fi
done < <(find "$src_dir" -maxdepth 1 -type f -iname '*.png' -mmin -10 -print0 2>/dev/null)

if [[ -z "$newest" ]]; then
  echo "✗ 최근 10분 내 스크린샷이 없습니다 ($src_dir)." >&2
  echo "  · Cmd+Shift+4 → Space → 창 클릭 으로 먼저 찍은 뒤 다시 실행하세요." >&2
  exit 1
fi

dir="$HOME/Screenshots/$repo_name"
mkdir -p "$dir"

n="${2:-}"
if [[ -z "$n" ]]; then
  n=1
  while [[ -e "$dir/$slug-$phase-$n.png" ]]; do n=$((n + 1)); done
fi
out="$dir/$slug-$phase-$n.png"

mv "$newest" "$out"
echo "$out  ← $(basename "$newest")"
