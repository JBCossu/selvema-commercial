type Line = { role: "assistant" | "user"; text: string };

const CONVERSATION: Line[] = [
  {
    role: "assistant",
    text: "Bonjour 👋 Je suis l'assistant de l'Agence Dupont. Un projet d'achat, de vente ou de location ?",
  },
  { role: "user", text: "Bonjour, je cherche à acheter un appartement à Lyon." },
  {
    role: "assistant",
    text: "Très bien ! Vous visez plutôt quel secteur de Lyon, et sur quel budget ?",
  },
  { role: "user", text: "Lyon 6e, autour de 400 000 €." },
  {
    role: "assistant",
    text: "Parfait. Un T3 conviendrait, ou vous cherchez plus grand ? Et pour quand souhaitez-vous concrétiser ?",
  },
  {
    role: "user",
    text: "Un T3, d'ici la fin de l'année. Nous sommes primo-accédants.",
  },
  {
    role: "assistant",
    text: "Merci pour ces précisions ! Je transmets votre projet à un conseiller. Pouvez-vous me laisser votre prénom, un email et un téléphone ?",
  },
  {
    role: "user",
    text: "Claire Martin — claire.martin@email.fr — 06 12 34 56 78",
  },
  {
    role: "assistant",
    text: "C'est noté Claire. Un conseiller de l'Agence Dupont vous recontacte très vite. Bonne journée !",
  },
];

export default function ChatMock() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a12]">
      {/* Barre de navigateur du site client */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-[#12121c] px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 rounded-md bg-black/40 px-3 py-1 text-xs text-white/40">
          www.agence-dupont.fr
        </span>
      </div>

      {/* Contenu factice du site + widget */}
      <div className="relative min-h-[560px] p-6">
        <div className="space-y-3 opacity-30">
          <div className="h-7 w-2/3 rounded bg-white/20" />
          <div className="h-3 w-full rounded bg-white/10" />
          <div className="h-3 w-11/12 rounded bg-white/10" />
          <div className="h-3 w-4/5 rounded bg-white/10" />
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="h-28 rounded-lg bg-white/10" />
            <div className="h-28 rounded-lg bg-white/10" />
            <div className="h-28 rounded-lg bg-white/10" />
          </div>
        </div>

        {/* Fenêtre du widget (ouverte) */}
        <div className="absolute bottom-20 right-4 flex h-[440px] w-[340px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-2xl border border-[#882de1] bg-black shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between border-b border-[#882de1]/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
              </span>
              <span className="text-sm font-semibold text-white">
                Agence Dupont
              </span>
            </div>
            <span className="text-white/40">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {CONVERSATION.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-[#882de1] text-white"
                      : "border border-[#882de1]/40 bg-[#0c0c14] text-white/90"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            <div className="flex justify-center">
              <span className="rounded-full border border-[#22c55e]/40 bg-[#22c55e]/10 px-3 py-1 text-[11px] text-[#22c55e]">
                Fiche prospect envoyée au dirigeant
              </span>
            </div>
          </div>

          <div className="border-t border-[#882de1]/40 p-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-xl border border-[#882de1]/50 bg-black px-3 py-2.5 text-sm text-white/40">
                Écrivez votre message…
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#882de1] text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 12l16-8-6 16-3-7-7-1z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
            <p className="mt-2 text-center text-[11px] text-white/30">
              Propulsé par Selvema
            </p>
          </div>
        </div>

        {/* Bouton lanceur */}
        <div className="absolute bottom-4 right-4 flex h-14 w-14 items-center justify-center rounded-full border border-[#882de1] bg-black shadow-[0_8px_30px_rgba(136,45,225,0.45)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5z"
              stroke="#fff"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
