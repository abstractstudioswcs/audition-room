"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type Tab = { href: string; label: string };

export function TopBar({
  kicker,
  title,
  home = "/app",
  tabs,
  right,
}: {
  kicker: string;
  title: string;
  home?: string;
  tabs?: Tab[];
  right?: ReactNode;
}) {
  const path = usePathname();
  return (
    <header className="top">
      <Link className="show" href={home}>
        <small>{kicker}</small>
        <strong>{title}</strong>
      </Link>
      <div className="topright">
        {tabs && tabs.length > 0 && (
          <nav className="tabs" aria-label="Views">
            {tabs.map((t) => (
              <Link key={t.href} href={t.href} aria-current={path === t.href ? "page" : undefined}>
                {t.label}
              </Link>
            ))}
          </nav>
        )}
        {right}
      </div>
    </header>
  );
}
