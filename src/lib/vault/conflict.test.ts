import { describe, it, expect } from "vitest";
import { createMemoryAdapter, ConflictError, withWriteLock } from "./adapter";

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

describe("withWriteLock — per-key 직렬화", () => {
  it("같은 key 면 두 번째 작업이 첫 번째 완료까지 대기", async () => {
    const order: string[] = [];
    const a = withWriteLock("p", async () => {
      order.push("a:start");
      await new Promise((r) => setTimeout(r, 30));
      order.push("a:end");
      return "A";
    });
    const b = withWriteLock("p", async () => {
      order.push("b:start");
      return "B";
    });
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra).toBe("A");
    expect(rb).toBe("B");
    expect(order).toEqual(["a:start", "a:end", "b:start"]);
  });

  it("다른 key 면 병렬", async () => {
    const order: string[] = [];
    const a = withWriteLock("p1", async () => {
      order.push("a:start");
      await new Promise((r) => setTimeout(r, 30));
      order.push("a:end");
    });
    const b = withWriteLock("p2", async () => {
      order.push("b:start");
      order.push("b:end");
    });
    await Promise.all([a, b]);
    // b 가 a 의 30ms 안에 시작되고 끝났어야 함
    expect(order.indexOf("b:end")).toBeLessThan(order.indexOf("a:end"));
  });

  it("첫 작업이 throw 해도 후속 작업은 실행", async () => {
    const failing = withWriteLock("p", async () => {
      throw new Error("boom");
    });
    const ok = withWriteLock("p", async () => "ok");
    await expect(failing).rejects.toThrow("boom");
    await expect(ok).resolves.toBe("ok");
  });
});
