import type { Metadata } from "next";
import Script from "next/script";
import DemoBodyClass from "./DemoBodyClass";

/**
 * /demo — faux site vitrine d'une agence immobilière indépendante.
 * Page PUBLIQUE (non listée dans le middleware) servant de démo commerciale :
 * elle intègre le widget Selvema Commercial exactement comme le ferait un vrai
 * client, via <script src="/widget.js" data-selvema-client="…">.
 */

export const metadata: Metadata = {
  title: "Agence Prestige Immobilier — Achat, vente & location",
  description:
    "Agence immobilière indépendante. Biens d'exception et accompagnement sur mesure.",
};

// Client de démo : « Agence Horizon Immobilier » (présent en base).
const DEMO_CLIENT_ID = "0c54b42f-6d2d-48d7-8b50-0b1980836181";

const serif = { fontFamily: "Georgia, 'Times New Roman', serif" } as const;

const HERO_IMG =
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1920&q=80";

type Bien = {
  titre: string;
  secteur: string;
  description: string;
  specs: string;
  prix: string;
  image: string;
};

const BIENS: Bien[] = [
  {
    titre: "Appartement haussmannien",
    secteur: "Lyon 6ᵉ — Foch",
    description:
      "Bel appartement de standing au 3ᵉ étage : parquet point de Hongrie, moulures et deux cheminées d'origine. Double séjour exposé sud, cuisine équipée, cave en sous-sol.",
    specs: "4 pièces · 112 m² · 2 chambres",
    prix: "685 000 €",
    image:
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80",
  },
  {
    titre: "Villa contemporaine d'architecte",
    secteur: "Écully — quartier résidentiel",
    description:
      "Maison lumineuse de plain-pied prolongée d'un étage. Grandes baies vitrées sur jardin paysager de 500 m², piscine chauffée, cuisine ouverte et garage double.",
    specs: "6 pièces · 180 m² · jardin 500 m²",
    prix: "1 250 000 €",
    image:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
  },
  {
    titre: "Studio entièrement rénové",
    secteur: "Villeurbanne — Charpennes",
    description:
      "Idéal premier investissement ou pied-à-terre. Rénovation complète, meublé et équipé, faibles charges. À deux pas du métro et des campus universitaires.",
    specs: "1 pièce · 28 m² · balcon",
    prix: "149 000 €",
    image:
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80",
  },
];

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <DemoBodyClass />

      {/* ── En-tête ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <a href="#accueil" className="flex items-baseline gap-2">
            <span
              className="text-lg font-semibold tracking-tight text-slate-900"
              style={serif}
            >
              Agence Prestige Immobilier
            </span>
          </a>
          <nav className="flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#accueil" className="transition-colors hover:text-slate-900">
              Accueil
            </a>
            <a href="#biens" className="transition-colors hover:text-slate-900">
              Nos biens
            </a>
            <a href="#contact" className="transition-colors hover:text-slate-900">
              Contact
            </a>
          </nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section
        id="accueil"
        className="relative flex min-h-[78vh] items-center bg-slate-800"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_IMG}
          alt="Villa contemporaine avec grandes baies vitrées"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/55 to-slate-950/25" />
        <div className="relative mx-auto w-full max-w-6xl px-6 py-24">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
            Agence indépendante · depuis 1998
          </p>
          <h1
            className="max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-6xl"
            style={serif}
          >
            Votre prochain chez-vous mérite un accompagnement d'exception.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/80">
            Achat, vente, location et estimation à Lyon et sa région. Une
            sélection resserrée de biens, un conseiller dédié à chaque projet.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <a
              href="#biens"
              className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-slate-900 transition-transform hover:-translate-y-0.5"
            >
              Découvrir nos biens
            </a>
            <a
              href="#contact"
              className="rounded-full border border-white/40 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Estimer mon bien
            </a>
          </div>
        </div>
      </section>

      {/* ── Nos biens ───────────────────────────────────────────── */}
      <section id="biens" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-14 max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#1e1ca8]">
            Nos biens
          </p>
          <h2
            className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl"
            style={serif}
          >
            Une sélection à visiter en ce moment
          </h2>
          <p className="mt-4 text-slate-600">
            Chaque bien est visité et vérifié par nos soins avant sa mise en
            ligne. Contactez l'agence pour organiser une visite.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {BIENS.map((bien) => (
            <article
              key={bien.titre}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-xl"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bien.image}
                  alt={bien.titre}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {bien.secteur}
                </p>
                <h3
                  className="mt-1 text-xl font-semibold text-slate-900"
                  style={serif}
                >
                  {bien.titre}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">
                  {bien.description}
                </p>
                <p className="mt-4 text-sm font-medium text-slate-500">
                  {bien.specs}
                </p>
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-5">
                  <span className="text-xl font-semibold text-slate-900">
                    {bien.prix}
                  </span>
                  <a
                    href="#contact"
                    className="text-sm font-semibold text-[#1e1ca8] transition-colors hover:text-[#882de1]"
                  >
                    Demander une visite →
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Contact ─────────────────────────────────────────────── */}
      <section id="contact" className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 sm:grid-cols-2">
          <div>
            <h2
              className="text-3xl font-semibold tracking-tight text-slate-900"
              style={serif}
            >
              Parlons de votre projet
            </h2>
            <p className="mt-4 max-w-md text-slate-600">
              Notre équipe vous répond du lundi au samedi. Passez à l'agence ou
              laissez-nous un message, un conseiller vous rappelle sous 24 h.
            </p>
          </div>
          <div className="space-y-3 text-slate-700">
            <p>
              <span className="font-semibold text-slate-900">Adresse —</span> 24
              cours Franklin Roosevelt, 69006 Lyon
            </p>
            <p>
              <span className="font-semibold text-slate-900">Téléphone —</span>{" "}
              04 72 00 00 00
            </p>
            <p>
              <span className="font-semibold text-slate-900">Email —</span>{" "}
              contact@agence-prestige-immobilier.fr
            </p>
            <p className="pt-2 text-sm text-slate-500">
              Carte professionnelle CPI 6901 2018 000 000 000 — Caisse de
              garantie 120 000 €.
            </p>
          </div>
        </div>
      </section>

      {/* ── Pied de page ────────────────────────────────────────── */}
      <footer className="bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold text-slate-700" style={serif}>
            Agence Prestige Immobilier
          </span>
          <nav className="flex gap-6">
            <a href="#accueil" className="hover:text-slate-900">
              Accueil
            </a>
            <a href="#biens" className="hover:text-slate-900">
              Nos biens
            </a>
            <a href="#contact" className="hover:text-slate-900">
              Contact
            </a>
          </nav>
          <span>© {new Date().getFullYear()} — Tous droits réservés.</span>
        </div>
      </footer>

      {/* ── Widget Selvema Commercial ───────────────────────────────
          Intégration identique à celle d'un vrai site client : le script
          charge le widget qui s'ouvre tout seul après ~2 s. */}
      <Script
        src="/widget.js"
        data-selvema-client={DEMO_CLIENT_ID}
        strategy="afterInteractive"
      />
    </div>
  );
}
