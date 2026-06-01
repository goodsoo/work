// 주어진 textarea 의 글자 index 위치(캐럿)가 textarea 좌상단 기준 몇 px top 인지 측정.
// textarea 는 내부 DOM 이 없어 위치 계산이 안 되므로, 동일 폰트·width·padding·wrap 규칙을
// 가진 mirror div 를 임시로 띄워 그 안 marker span 의 offsetTop 을 읽는다 (textarea-caret
// -position 라이브러리와 동일 기법). wrap=soft 로 접힌 줄도 정확히 반영. 측정 후 mirror 제거.
//
// 탐색 네비게이션(매치 이동) 시점에만 호출 — typing 마다가 아니라 비용 무시 가능.

// mirror 가 복사해야 글자 흐름이 textarea 와 일치하는 computed style 목록 (kebab-case).
const MIRRORED_PROPS = [
  "box-sizing",
  "width",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-variant",
  "letter-spacing",
  "line-height",
  "text-transform",
  "text-indent",
  "word-spacing",
  "white-space",
  "word-break",
  "overflow-wrap",
  "tab-size",
];

export function measureCaretTop(
  textarea: HTMLTextAreaElement,
  index: number,
): number {
  const cs = window.getComputedStyle(textarea);
  const div = document.createElement("div");
  for (const prop of MIRRORED_PROPS) {
    div.style.setProperty(prop, cs.getPropertyValue(prop));
  }
  // textarea wrap=soft 는 pre-wrap 과 동일하게 동작. computed 가 normal 로 떨어지면 보정.
  if (div.style.whiteSpace === "normal" || div.style.whiteSpace === "") {
    div.style.whiteSpace = "pre-wrap";
  }
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.top = "0";
  div.style.left = "-9999px";
  div.style.height = "auto";
  div.style.overflow = "hidden";

  // 캐럿 앞 텍스트 → marker → 나머지. marker 의 offsetTop 이 캐럿 줄 top.
  // 나머지를 넣어야 현재 줄의 wrap 경계가 textarea 와 동일해진다.
  div.textContent = textarea.value.slice(0, index);
  const marker = document.createElement("span");
  // 빈 문자열이면 offsetTop 이 0 으로 죽지 않게 zero-width space 보강.
  marker.textContent = textarea.value.slice(index) || "​";
  div.appendChild(marker);

  document.body.appendChild(div);
  const top = marker.offsetTop;
  document.body.removeChild(div);
  return top;
}
