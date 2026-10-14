"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";

type MobileNavigationProps = {
  children: ReactNode;
};

export function MobileNavigation({ children }: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b bg-surface px-4 py-3 lg:hidden">
      <div className="flex items-center justify-between gap-4">
        <Link href="/study" className="rounded-sm font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          PTE Study
        </Link>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls="mobile-study-navigation"
          onClick={() => setIsOpen((current) => !current)}
          className="inline-flex min-h-10 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isOpen ? "Close menu" : "Menu"}
        </button>
      </div>
      {isOpen ? (
        <div
          id="mobile-study-navigation"
          className="mt-4 max-h-[70svh] overflow-y-auto border-t pt-4"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) setIsOpen(false);
          }}
        >
          {children}
          <div className="mt-4 border-t pt-4">
            <SignOutButton />
          </div>
        </div>
      ) : null}
    </div>
  );
}
