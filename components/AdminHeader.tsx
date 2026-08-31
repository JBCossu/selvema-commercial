import Link from "next/link";
import Logo from "@/components/Logo";
import LogoutButton from "@/components/LogoutButton";

export default function AdminHeader() {
  return (
    <header className="flex items-center justify-between gap-4">
      <Logo />
      <nav className="flex items-center gap-5 text-sm text-white/70">
        <Link href="/dashboard" className="transition-colors hover:text-white">
          Dashboard
        </Link>
        <a
          href="/demo"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 transition-colors hover:text-white"
        >
          Aperçu
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M14 5h5v5M19 5l-8 8M12 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
        <Link
          href="/clients/nouveau"
          className="rounded-full border border-[#882de1] px-4 py-2 font-semibold text-white transition-colors duration-150 hover:border-[#c39bf0] hover:bg-[#882de1]/15"
        >
          + Nouveau client
        </Link>
        <LogoutButton />
      </nav>
    </header>
  );
}
