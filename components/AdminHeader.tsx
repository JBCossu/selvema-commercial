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
