import { createContext, useContext, type ReactNode } from "react";

// 사이드바 열기/닫기 토글 — 본문 PageHeaderBar 좌측(undo/redo 왼쪽)에서 호출.
// AppShell 이 useSidebarCollapsed 상태를 context 로 주입 → 모든 페이지 헤더가 같은
// 자리에 같은 버튼(열림=닫기 아이콘 / 닫힘=열기 아이콘)을 렌더. 데스크탑 전용 개념.
export type SidebarToggle = { collapsed: boolean; toggle: () => void };

const SidebarToggleContext = createContext<SidebarToggle | null>(null);

export function SidebarToggleProvider({
  value,
  children,
}: {
  value: SidebarToggle | null;
  children: ReactNode;
}) {
  return (
    <SidebarToggleContext.Provider value={value}>
      {children}
    </SidebarToggleContext.Provider>
  );
}

// null = provider 밖 (예: styleguide) 또는 토글 불가 → 버튼 미표시.
// eslint-disable-next-line react-refresh/only-export-components
export function useSidebarToggle() {
  return useContext(SidebarToggleContext);
}
