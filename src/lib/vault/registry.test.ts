import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addVault,
  getActiveVault,
  getActiveVaultId,
  getVaults,
  removeVault,
  renameVault,
  setActiveVaultId,
} from "./registry";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("vault registry", () => {
  it("빈 상태에서 getVaults 는 빈 배열", () => {
    expect(getVaults()).toEqual([]);
    expect(getActiveVaultId()).toBeNull();
    expect(getActiveVault()).toBeNull();
  });

  it("addVault 후 list 에 한 항목 추가", () => {
    const entry = addVault("개인", "/Users/me/personal-vault");
    expect(entry.name).toBe("개인");
    expect(entry.path).toBe("/Users/me/personal-vault");
    expect(entry.id).toBeTruthy();
    expect(getVaults()).toHaveLength(1);
  });

  it("같은 path 로 addVault 호출 시 중복 안 만듦", () => {
    const a = addVault("개인", "/Users/me/personal-vault");
    const b = addVault("회사", "/Users/me/personal-vault");
    expect(a.id).toBe(b.id);
    expect(getVaults()).toHaveLength(1);
  });

  it("이름 비우면 폴더명으로 자동 보충", () => {
    const entry = addVault("", "/Users/me/work-vault");
    expect(entry.name).toBe("work-vault");
  });

  it("setActiveVaultId 후 getActiveVault 가 그 entry 반환", () => {
    const entry = addVault("개인", "/Users/me/personal-vault");
    setActiveVaultId(entry.id);
    expect(getActiveVault()?.id).toBe(entry.id);
  });

  it("removeVault — list 에서 빼고, active 면 active 도 해제", () => {
    const a = addVault("개인", "/p");
    const b = addVault("회사", "/w");
    setActiveVaultId(a.id);
    removeVault(a.id);
    expect(getVaults().map((v) => v.id)).toEqual([b.id]);
    expect(getActiveVaultId()).toBeNull();
  });

  it("renameVault — name 만 갱신, id/path 보존", () => {
    const entry = addVault("개인", "/p");
    renameVault(entry.id, "내 개인 vault");
    const updated = getVaults()[0];
    expect(updated.id).toBe(entry.id);
    expect(updated.path).toBe("/p");
    expect(updated.name).toBe("내 개인 vault");
  });

  it("renameVault — 빈 이름은 no-op", () => {
    const entry = addVault("개인", "/p");
    renameVault(entry.id, "   ");
    expect(getVaults()[0].name).toBe("개인");
  });
});
