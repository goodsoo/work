import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type DrawerContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const DrawerContext = createContext<DrawerContextValue>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
});

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const value = useMemo<DrawerContextValue>(
    () => ({
      isOpen,
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen((v) => !v),
    }),
    [isOpen],
  );
  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

export function useDrawer() {
  return useContext(DrawerContext);
}
