"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "selvema_commercial_conversation";

export default function ChatWidget({
  agencyName,
  ready,
  embedded = false,
}: {
  agencyName: string;
  ready: boolean;
  embedded?: boolean;
}) {
  const greeting = ready
    ? `Bonjour 👋 Je suis l'assistant de ${agencyName}. Un projet d'achat, de vente ou de location ? Dites-m'en un peu plus, je vous oriente.`
    : `Bonjour 👋 L'assistant en ligne est en cours de configuration. Merci de revenir un peu plus tard.`;

  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: greeting },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setConversationId(saved);
    } catch {
      /* localStorage indisponible */
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading || !ready) return;

    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");

      if (data.conversationId && data.conversationId !== conversationId) {
        setConversationId(data.conversationId);
        try {
          localStorage.setItem(STORAGE_KEY, data.conversationId);
        } catch {
          /* ignore */
        }
      }
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Désolé, une erreur est survenue. Pouvez-vous réessayer dans un instant ?",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`flex h-full w-full flex-col overflow-hidden bg-black text-white ${
        embedded ? "" : "rounded-2xl border border-[#882de1]"
      }`}
    >
      {/* En-tête */}
      <div className="flex items-center justify-between gap-3 border-b border-[#882de1]/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
          </span>
          <span className="text-sm font-semibold">{agencyName || "Assistant"}</span>
        </div>
        {embedded && (
          <button
            aria-label="Fermer"
            onClick={() =>
              window.parent?.postMessage({ type: "selvema-widget-close" }, "*")
            }
            className="text-white/60 transition-colors hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Fil de messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
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
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-2xl border border-[#882de1]/40 bg-[#0c0c14] px-4 py-3">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="h-1.5 w-1.5 rounded-full bg-white/70 animate-pulse-dot"
                  style={{ animationDelay: `${d * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Saisie */}
      <div className="border-t border-[#882de1]/40 p-3">
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={input}
            disabled={!ready}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={ready ? "Écrivez votre message…" : "Indisponible"}
            className="max-h-28 flex-1 resize-none rounded-xl border border-[#882de1]/50 bg-black px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-[#882de1]"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim() || !ready}
            aria-label="Envoyer"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#882de1] text-white transition-colors hover:bg-[#882de1]/20 disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 12l16-8-6 16-3-7-7-1z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-white/30">
          Propulsé par Selvema
        </p>
      </div>
    </div>
  );
}
