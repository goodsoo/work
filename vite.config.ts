/// <reference types="vitest/config" />
import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// 현재 체크아웃된 git 브랜치 — dev 창 제목에 박아 worktree 세션을 구분한다.
// config 평가 시점(=dev 서버 기동 시점)에 한 번 읽으므로 worktree 별로 다른 값이 들어간다.
function currentBranch(): string {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

export default defineConfig({
  server: {
    port: Number(process.env.VITE_PORT) || 7030,
    strictPort: true,
  },
  define: {
    __DEV_BRANCH__: JSON.stringify(currentBranch()),
  },
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
