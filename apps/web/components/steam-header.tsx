"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SteamHeader() {
  const path = usePathname();
  const storeActive = path === "/" || path.startsWith("/games/");
  const devActive = path.startsWith("/developers");

  return (
    <header className="steam-header">
      <div className="steam-header-inner">
        <Link href="/" className="steam-logo">
          STEAM FUND
        </Link>
        <nav className="steam-nav" aria-label="Main">
          <Link href="/" className={storeActive ? "steam-nav-active" : undefined}>
            Store
          </Link>
          <Link href="/developers" className={devActive ? "steam-nav-active" : undefined}>
            Developers
          </Link>
        </nav>
      </div>
    </header>
  );
}
