import { describe, it, expect } from "vitest";
import { createMemoryAdapter } from "./vault/adapter";
import {
  deleteAttachments,
  extractAttachmentRefs,
  findOrphanAttachments,
  kebabCase,
  mimeToExt,
  nextAttachmentIndex,
  saveAttachment,
} from "./attachments";

describe("mimeToExt", () => {
  it("maps common image MIMEs", () => {
    expect(mimeToExt("image/png")).toBe("png");
    expect(mimeToExt("image/jpeg")).toBe("jpg");
    expect(mimeToExt("image/gif")).toBe("gif");
    expect(mimeToExt("image/webp")).toBe("webp");
  });

  it("returns null for unknown / non-image", () => {
    expect(mimeToExt("application/pdf")).toBeNull();
    expect(mimeToExt("")).toBeNull();
  });
});

describe("kebabCase", () => {
  it("converts spaces + punctuation, keeps Korean", () => {
    expect(kebabCase("회의록 2026-05-26")).toBe("회의록-2026-05-26");
    expect(kebabCase("Foo / Bar?")).toBe("foo-bar");
  });

  it("collapses repeated hyphens + lowercases", () => {
    expect(kebabCase("Hello   World!!")).toBe("hello-world");
  });

  it("returns empty for non-alphanumeric input", () => {
    expect(kebabCase("!@#$%")).toBe("");
    expect(kebabCase("   ")).toBe("");
  });
});

describe("nextAttachmentIndex", () => {
  it("returns 1 for empty / missing dir", async () => {
    const a = createMemoryAdapter();
    a.setRoot("/vault");
    expect(await nextAttachmentIndex(a, "notes/_attachments/foo")).toBe(1);
  });

  it("returns max(n)+1 from existing N.ext files", async () => {
    const a = createMemoryAdapter();
    a.setRoot("/vault");
    await a.writeBinary(
      "notes/_attachments/foo/1.png",
      new Uint8Array([1]),
    );
    await a.writeBinary(
      "notes/_attachments/foo/2.jpg",
      new Uint8Array([2]),
    );
    await a.writeBinary(
      "notes/_attachments/foo/5.gif",
      new Uint8Array([3]),
    );
    expect(await nextAttachmentIndex(a, "notes/_attachments/foo")).toBe(6);
  });

  it("ignores non-numeric prefixed names", async () => {
    const a = createMemoryAdapter();
    a.setRoot("/vault");
    await a.writeBinary(
      "notes/_attachments/foo/before-1.png",
      new Uint8Array([1]),
    );
    expect(await nextAttachmentIndex(a, "notes/_attachments/foo")).toBe(1);
  });
});

describe("saveAttachment", () => {
  it("writes bytes + returns vault-relative path", async () => {
    const a = createMemoryAdapter();
    a.setRoot("/vault");
    const blob = new Blob([new Uint8Array([0xff, 0xd8])], {
      type: "image/jpeg",
    });
    const path = await saveAttachment(a, {
      baseDir: "notes",
      slug: "회의록-2026-05-26",
      file: blob,
    });
    expect(path).toBe("notes/_attachments/회의록-2026-05-26/1.jpg");
    const dump = a.__dumpBinary();
    expect(dump.has(path)).toBe(true);
    expect(dump.get(path)!.bytes.length).toBe(2);
  });

  it("auto-increments within same slug", async () => {
    const a = createMemoryAdapter();
    a.setRoot("/vault");
    const blob = () => new Blob([new Uint8Array([1])], { type: "image/png" });
    const p1 = await saveAttachment(a, {
      baseDir: "notes",
      slug: "foo",
      file: blob(),
    });
    const p2 = await saveAttachment(a, {
      baseDir: "notes",
      slug: "foo",
      file: blob(),
    });
    expect(p1).toBe("notes/_attachments/foo/1.png");
    expect(p2).toBe("notes/_attachments/foo/2.png");
  });

  it("throws on unsupported MIME", async () => {
    const a = createMemoryAdapter();
    a.setRoot("/vault");
    const blob = new Blob([new Uint8Array([1])], {
      type: "application/pdf",
    });
    await expect(
      saveAttachment(a, { baseDir: "notes", slug: "foo", file: blob }),
    ).rejects.toThrow(/unsupported image mime/);
  });

  it("uses explicit mime override when blob.type is empty", async () => {
    const a = createMemoryAdapter();
    a.setRoot("/vault");
    const blob = new Blob([new Uint8Array([1])]);
    const path = await saveAttachment(a, {
      baseDir: "notes",
      slug: "foo",
      file: blob,
      mime: "image/png",
    });
    expect(path).toBe("notes/_attachments/foo/1.png");
  });
});

describe("extractAttachmentRefs", () => {
  it("picks vault-relative image paths", () => {
    const body =
      "본문\n\n![first](notes/_attachments/foo/1.png)\n\n다른\n\n![](notes/_attachments/foo/2.jpg)";
    expect(extractAttachmentRefs(body)).toEqual([
      "notes/_attachments/foo/1.png",
      "notes/_attachments/foo/2.jpg",
    ]);
  });

  it("excludes external URLs and data/asset/blob", () => {
    const body =
      "![](https://example.com/a.png)\n![](data:image/png;base64,xx)\n![](asset://x)\n![](notes/_attachments/foo/1.png)";
    expect(extractAttachmentRefs(body)).toEqual([
      "notes/_attachments/foo/1.png",
    ]);
  });

  it("strips markdown title (path with quoted title)", () => {
    expect(
      extractAttachmentRefs(`![](notes/_attachments/foo/1.png "캡션")`),
    ).toEqual(["notes/_attachments/foo/1.png"]);
  });
});

describe("findOrphanAttachments", () => {
  it("returns empty when all attachments are referenced", async () => {
    const a = createMemoryAdapter();
    a.setRoot("/vault");
    await a.write(
      "notes/foo.md",
      "본문\n![](notes/_attachments/foo/1.png)",
    );
    await a.writeBinary(
      "notes/_attachments/foo/1.png",
      new Uint8Array([1]),
    );
    expect(await findOrphanAttachments(a, "notes")).toEqual([]);
  });

  it("detects orphans not referenced by any meeting", async () => {
    const a = createMemoryAdapter();
    a.setRoot("/vault");
    await a.write(
      "notes/foo.md",
      "본문\n![](notes/_attachments/foo/1.png)",
    );
    await a.writeBinary(
      "notes/_attachments/foo/1.png",
      new Uint8Array([1]),
    );
    await a.writeBinary(
      "notes/_attachments/foo/2.png",
      new Uint8Array([2]),
    );
    await a.writeBinary(
      "notes/_attachments/orphan/1.png",
      new Uint8Array([3]),
    );
    const orphans = await findOrphanAttachments(a, "notes");
    expect(orphans.sort()).toEqual([
      "notes/_attachments/foo/2.png",
      "notes/_attachments/orphan/1.png",
    ]);
  });

  it("respects trash references — restored meeting won't break", async () => {
    const a = createMemoryAdapter();
    a.setRoot("/vault");
    await a.write(
      ".trash/2026-05-26T10-00-00-foo.md",
      "본문\n![](notes/_attachments/foo/1.png)",
    );
    await a.writeBinary(
      "notes/_attachments/foo/1.png",
      new Uint8Array([1]),
    );
    expect(await findOrphanAttachments(a, "notes")).toEqual([]);
  });

  it("returns empty when attachments dir is missing", async () => {
    const a = createMemoryAdapter();
    a.setRoot("/vault");
    await a.write("notes/foo.md", "본문");
    expect(await findOrphanAttachments(a, "notes")).toEqual([]);
  });
});

describe("deleteAttachments", () => {
  it("deletes given paths and removes them from vault", async () => {
    const a = createMemoryAdapter();
    a.setRoot("/vault");
    await a.writeBinary(
      "notes/_attachments/foo/1.png",
      new Uint8Array([1]),
    );
    await a.writeBinary(
      "notes/_attachments/foo/2.png",
      new Uint8Array([2]),
    );
    const result = await deleteAttachments(a, [
      "notes/_attachments/foo/1.png",
    ]);
    expect(result.deleted).toEqual(["notes/_attachments/foo/1.png"]);
    expect(result.errors).toEqual([]);
    expect(await a.exists("notes/_attachments/foo/1.png")).toBe(false);
    expect(await a.exists("notes/_attachments/foo/2.png")).toBe(true);
  });
});
