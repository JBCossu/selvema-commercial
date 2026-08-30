import Link from "next/link";
import Logo from "@/components/Logo";

type NavLink = { href: string; label: string };

export default function PageHeader({ links = [] }: { links?: NavLink[] }) {
  return (
    <header className="flex items-center justify-between">
      <Logo />
      <nav className="flex items-center gap-5 text-sm text-white/70">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="transition-colors hover:text-white"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
