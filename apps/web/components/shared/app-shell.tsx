import Link from "next/link";
import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  description: string;
};

const navItems: NavItem[] = [
  { href: "/", label: "Home", description: "Overview and launch points" },
  { href: "/marketplace", label: "Marketplace", description: "Browse and compare workflows" },
  { href: "/my-agents", label: "My Agents", description: "Operate installed automations" },
  { href: "/studio", label: "Studio", description: "Draft and publish new workflows" },
  { href: "/settings", label: "Settings", description: "Manage profile and credentials" },
];

export function AppShell({
  children,
  currentPath,
}: {
  children: ReactNode;
  currentPath: string;
}) {
  const currentIndex = navItems.findIndex((item) => item.href === currentPath);
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;
  const currentItem = navItems[activeIndex];
  const previousItem = activeIndex > 0 ? navItems[activeIndex - 1] : null;
  const nextItem = activeIndex < navItems.length - 1 ? navItems[activeIndex + 1] : null;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-main">
          <Link className="brand" href="/">
            <span className="brand-mark">LH</span>
            <span className="brand-copy">
              <strong>LonghorNet</strong>
              <span>UT workflow marketplace</span>
            </span>
          </Link>
          <div className="topbar-meta">
            <span>UT Austin student beta</span>
          </div>
        </div>

        <nav className="topnav" aria-label="Primary">
          {navItems.map((item) => {
            const isActive = currentPath === item.href;
            return (
              <Link
                key={item.href}
                className={isActive ? "nav-link active" : "nav-link"}
                href={item.href}
              >
                <span className="nav-copy">{item.label}</span>
                <span className="nav-detail">{item.description}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flowbar">
          <div className="flowbar-copy">
            <strong>{currentItem.label}</strong>
            <span>{currentItem.description}</span>
          </div>
          <div className="flowbar-actions">
            {previousItem ? (
              <Link className="flow-link" href={previousItem.href}>
                Previous: {previousItem.label}
              </Link>
            ) : null}
            {nextItem ? (
              <Link className="flow-link accent" href={nextItem.href}>
                Next: {nextItem.label}
              </Link>
            ) : null}
          </div>
        </div>
      </header>
      <main className="page-frame">{children}</main>
    </div>
  );
}
