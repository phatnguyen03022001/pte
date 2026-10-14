import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { NavigationList } from "@/components/layout/navigation-list";

export function AppSidebar() {
  return (
    <aside className="hidden h-svh w-72 shrink-0 flex-col border-r bg-surface lg:flex">
      <div className="border-b px-5 py-5">
        <Link href="/study" className="rounded-sm text-base font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          PTE Study
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        <NavigationList />
      </div>
      <div className="border-t p-4">
        <SignOutButton />
      </div>
    </aside>
  );
}
