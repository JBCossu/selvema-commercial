import CopyButton from "@/components/CopyButton";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default function IntegrationPage() {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://votre-domaine.selvema.com";
  const snippet = `<script src="${appUrl}/widget.js" async></script>`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader
        links={[
          { href: "/", label: "Accueil" },
          { href: "/chatbot", label: "Chatbot" },
          { href: "/relances", label: "Relances" },
        ]}
      />

      <div className="mt-10 animate-fade-in-up">
        <h1 className="text-2xl font-bold tracking-tight">
          Intégration du widget
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Une seule balise à coller sur n'importe quelle page du site du client,
          juste avant <code className="text-[#c39bf0]">&lt;/body&gt;</code>.
        </p>

        <div className="mt-8 card">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-[#c39bf0]">
              Balise à installer
            </h2>
            <CopyButton text={snippet} />
          </div>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-[#882de1]/50 bg-[#0c0c14] p-4 text-sm text-[#c39bf0]">
            <code>{snippet}</code>
          </pre>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            {
              t: "1 · Coller la balise",
              d: "Dans le template du site (footer, layout, ou gestionnaire de balises).",
            },
            {
              t: "2 · Le widget apparaît",
              d: "Un bouton flottant en bas à droite s'ouvre sur la fenêtre de discussion.",
            },
            {
              t: "3 · Rien d'autre à faire",
              d: "Le contenu des réponses est piloté depuis la page Configuration.",
            },
          ].map((s) => (
            <div key={s.t} className="card">
              <h3 className="text-sm font-semibold text-[#c39bf0]">{s.t}</h3>
              <p className="mt-2 text-sm text-white/70">{s.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 card text-sm text-white/70">
          <h2 className="text-sm font-semibold text-white">Détails techniques</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>
              Le script charge une iframe pointant vers{" "}
              <code className="text-[#c39bf0]">{appUrl}/embed</code>. Aucune
              donnée du site hôte n'est lue.
            </li>
            <li>Chargement asynchrone : aucun impact sur la vitesse de la page.</li>
            <li>
              Responsive : fenêtre ancrée en bas à droite sur ordinateur, plein
              écran sur mobile.
            </li>
            <li>
              Compatible avec tout site (WordPress, Wix, Webflow, site sur
              mesure…).
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
