"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { isNavigationItemActive } from "@/lib/study/question-types";

type NavigationItemProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

export function NavigationItem({ href, children, className }: NavigationItemProps) {
  const pathname = usePathname();
  const isActive = isNavigationItemActive(pathname, href);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex min-h-9 items-center gap-3 rounded-md border-l-2 px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isActive
          ? "border-brand-orange bg-accent font-medium text-foreground"
          : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      {children}
    </Link>
  );
}
