import Image from "next/image";
import Link from "next/link";

export default function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-3">
      <Image
        src="/logo.png"
        alt="Selvema"
        width={44}
        height={44}
        className="h-11 w-11 object-contain"
      />
      <span className="text-xl font-bold tracking-tight text-white transition-colors duration-150 group-hover:text-[#c39bf0] sm:text-2xl">
        Selvema&nbsp;Commercial
      </span>
    </Link>
  );
}
