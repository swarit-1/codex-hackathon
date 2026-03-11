import Link from "next/link";
import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  { href: "/", label: "Marketplace" },
  { href: "/my-agents", label: "My Agents" },
  { href: "/studio", label: "Studio" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({
  children,
  currentPath,
}: {
  children: ReactNode;
  currentPath: string;
}) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">LH</span>
          <span className="brand-copy">
            <strong>LonghorNet</strong>
            <span>UT workflow marketplace</span>
          </span>
        </Link>

        <nav className="topnav" aria-label="Primary">
          {navItems.map((item) => {
            const isMarketplace = currentPath === "/" || currentPath === "/marketplace";
            const isActive = item.href === "/" ? isMarketplace : currentPath === item.href;
            return (
              <Link
                key={item.href}
                className={isActive ? "nav-link active" : "nav-link"}
                href={item.href}
              >
                <span className="nav-copy">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="topbar-meta">
          <span>UT Austin student beta</span>
        </div>
      </header>
      <main className="page-frame">{children}</main>
    </div>
  );
}
