import type { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileNavigation } from "@/components/layout/mobile-navigation";
import { NavigationList } from "@/components/layout/navigation-list";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-svh bg-background">
      <AppSidebar />
      <div className="flex min-h-svh min-w-0 flex-1 flex-col">
        <MobileNavigation>
          <NavigationList />
        </MobileNavigation>
        <main className="min-w-0 flex-1 px-page py-section">{children}</main>
      </div>
    </div>
  );
}
