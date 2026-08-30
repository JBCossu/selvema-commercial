import ChatMock from "@/components/ChatMock";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default function ChatbotPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader
        links={[
          { href: "/", label: "Accueil" },
          { href: "/integration", label: "Intégration" },
          { href: "/relances", label: "Relances" },
        ]}
      />

      <div className="mt-10 animate-fade-in-up">
        <h1 className="text-2xl font-bold tracking-tight">Le chatbot</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/60">
          Voici comment le widget apparaît sur le site du client. Il se présente
          comme l'assistant de l'agence, répond à partir de la base de
          connaissances et qualifie le prospect en posant naturellement les
          questions clés (projet, budget, bien, secteur, délai, situation). Dès
          qu'il a assez d'informations, il envoie une fiche prospect au dirigeant.
        </p>

        <div className="mt-8">
          <ChatMock />
        </div>

        <p className="mt-4 text-center text-xs text-white/40">
          Exemple de conversation — le contenu réel des réponses est piloté depuis
          la page{" "}
          <a href="/config" className="text-[#c39bf0] hover:underline">
            Configuration
          </a>
          .
        </p>
      </div>
    </div>
  );
}
