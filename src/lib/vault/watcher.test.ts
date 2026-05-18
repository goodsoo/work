import { describe, it, expect, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createMemoryAdapter } from "./adapter";
import { createVaultWatcher } from "./watcher";

describe("VaultWatcher", () => {
  it("vault 의 modified 이벤트 → 영향 query key invalidate", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    await adapter.write("meetings/2026-05-16-test.md", "# 본문\n초기\n");

    const qc = new QueryClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const watcher = createVaultWatcher(adapter, qc);
    await watcher.start();

    // 외부 변경 시뮬 (다른 source 가 modified 이벤트 발행)
    adapter.__trigger({
      type: "modified",
      path: "meetings/2026-05-16-test.md",
    });

    // debounce 100ms 대기
    await new Promise((r) => setTimeout(r, 150));

    expect(invalidateSpy).toHaveBeenCalled();
    const calls = invalidateSpy.mock.calls.map((c) =>
      JSON.stringify((c[0] as { queryKey: unknown }).queryKey),
    );
    expect(calls.some((c) => c.includes("meetings"))).toBe(true);
    expect(calls.some((c) => c.includes("todos"))).toBe(true);

    watcher.stop();
  });

  it("우리가 직접 write 한 직후의 modified 이벤트는 무시 (selfWriteWindow)", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");

    const qc = new QueryClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const watcher = createVaultWatcher(adapter, qc, { selfWriteWindowMs: 500 });
    await watcher.start();

    // 자기 write 등록 → 그 직후 modified 이벤트 발행
    const path = "meetings/2026-05-16-test.md";
    watcher.markSelfWrite(path);
    adapter.__trigger({ type: "modified", path });

    await new Promise((r) => setTimeout(r, 150));

    expect(invalidateSpy).not.toHaveBeenCalled();

    watcher.stop();
  });
});
