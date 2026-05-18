import { useContext } from "react";
import { VaultContext, type VaultContextValue } from "./VaultProvider";

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be inside VaultProvider");
  return ctx;
}
