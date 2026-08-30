import Link from "next/link";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic";

const CARDS = [
  {
    href: "/config",
    title: "Configuration",
    desc: "Renseignez l'agence, la FAQ et les biens disponibles — la base de connaissances de l'assistant.",
  },
  {
    href: "/chatbot",
    title: "Chatbot",
    desc: "Aperçu du widget de discussion tel qu'il apparaît sur le site du client.",
  },
  {
    href: "/relances",
    title: "Relances",
    desc: "Suivi des prospects en cours et de leurs relances automatiques J+3 et J+7.",
  },
  {
    href: "/integration",
    title: "Intégration",
    desc: "La balise script à coller sur le site du client pour afficher le widget.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-5 text-sm text-white/70">
          <Link href="/config" className="transition-colors hover:text-white">
            Configuration
          </Link>
          <Link href="/relances" className="transition-colors hover:text-white">
            Relances
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col justify-center py-16">
        <div className="animate-fade-in-up">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#c39bf0]">
            Selvema Commercial
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            L'assistant en ligne qui qualifie vos prospects,
            <br className="hidden sm:block" /> pendant que vous vendez.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/70">
            Un widget de discussion s'intègre à votre site en une ligne. Il
            répond aux visiteurs à partir de vos informations, recueille
            naturellement leur projet, et vous envoie une fiche prospect
            structurée par email. Puis il relance automatiquement à J+3 et J+7.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CARDS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group rounded-2xl border border-[#882de1] bg-black p-6 transition-all duration-150 hover:-translate-y-1 hover:border-[#c39bf0] hover:bg-[#882de1]/10 hover:shadow-[0_10px_40px_-12px_rgba(136,45,225,0.6)]"
            >
              <h3 className="flex items-center justify-between text-sm font-semibold text-[#c39bf0]">
                {c.title}
                <span className="translate-x-0 text-white/40 transition-transform duration-150 group-hover:translate-x-1 group-hover:text-[#c39bf0]">
                  →
                </span>
              </h3>
              <p className="mt-2 text-sm text-white/70">{c.desc}</p>
            </Link>
          ))}
        </div>
      </main>

      <footer className="border-t border-white/10 py-6 text-sm text-white/40">
        Selvema — solutions logicielles IA sur mesure.
      </footer>
    </div>
  );
}
