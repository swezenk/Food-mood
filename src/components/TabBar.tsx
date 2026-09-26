"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home" },
  { href: "/patterns", label: "Patterns" },
  { href: "/me", label: "Me" },
];

export default function TabBar() {
  const pathname = usePathname();
  return (
    <div className="tabbar">
      <nav aria-label="Main">
        {TABS.map((t) => {
          const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}>
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
