/// <reference types="vite/client" />

// vite.config.ts 의 define 으로 주입되는 현재 git 브랜치 (dev 창 제목용).
// 빈 문자열이면 git 조회 실패 또는 비-git 환경.
declare const __DEV_BRANCH__: string;
