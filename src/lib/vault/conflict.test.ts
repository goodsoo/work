import { describe, it, expect } from "vitest";
import { createMemoryAdapter, ConflictError } from "./adapter";

describe("write — optimistic concurrency", () => {
  it("expectedMtime 이 현재 mtime 과 다르면 ConflictError throw", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    const meta = await adapter.write("test.md", "초기 내용");

    // 외부에서 변경 발생 (다른 source 가 같은 파일 write)
    const newMeta = await adapter.write("test.md", "외부 변경 내용");
    expect(newMeta.mtime).toBeGreaterThan(meta.mtime);

    // 우리는 옛 mtime 으로 write 시도
    await expect(
      adapter.write("test.md", "내 변경", meta.mtime),
    ).rejects.toBeInstanceOf(ConflictError);

    // 파일은 외부 변경된 상태 그대로
    const content = await adapter.read("test.md");
    expect(content).toBe("외부 변경 내용");
  });

  it("expectedMtime 일치하면 정상 write", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    const meta = await adapter.write("test.md", "초기");

    const newMeta = await adapter.write("test.md", "갱신", meta.mtime);
    expect(newMeta.mtime).toBeGreaterThan(meta.mtime);

    const content = await adapter.read("test.md");
    expect(content).toBe("갱신");
  });
});
