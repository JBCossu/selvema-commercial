"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const DEFAULT_COLOR = "#882de1";
const DEFAULT_TAGLINE = "Une question ? Je suis là pour vous aider.";
const DARK_BG = "#0a0a1a";

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(136,45,225,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * Personnage mascotte — image PNG fournie (mascotte 3D violette, bras croisés).
 * Fichier : public/selvema-mascot.png (servi à /selvema-mascot.png depuis
 * l'origine de l'app, même origine que la page /embed).
 * Affichée dans la zone haute (20 %), à gauche de l'accroche, à sa taille
 * proportionnelle (object-fit: contain), assez grande pour remplir la zone ;
 * le bas déborde et est coupé par l'overflow:hidden de la zone.
 */
function Character() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/selvema-mascot.png"
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
        objectPosition: "left top",
        display: "block",
        userSelect: "none",
      }}
    />
  );
}

export default function ChatWidget({
  clientId,
  agencyName,
  tagline = DEFAULT_TAGLINE,
  ready,
  color = DEFAULT_COLOR,
}: {
  clientId: string;
  agencyName: string;
  tagline?: string;
  ready: boolean;
  color?: string;
}) {
  const accent = /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_COLOR;
  const storageKey = `selvema_conv_${clientId}`;

  // Accroche sur deux lignes : coupe après la 1re ponctuation forte.
  const cleanTagline = (tagline || DEFAULT_TAGLINE).trim();
  const tlMatch = cleanTagline.match(/^(.*?[?!.…])\s+(.+)$/);
  const line1 = tlMatch ? tlMatch[1].trim() : cleanTagline;
  const line2 = tlMatch ? tlMatch[2].trim() : "";
  const fullTagline = line2 ? `${line1}\n${line2}` : line1;

  const greeting = ready
    ? `Bonjour ! Je suis l'assistant de ${agencyName}. Posez moi n'importe quelle question sur un bien, une démarche, ou quoi que ce soit. 😊`
    : `Bonjour 👋 L'assistant en ligne est momentanément indisponible. Merci de revenir un peu plus tard.`;

  // La conversation démarre vide : le message de bienvenue n'apparaît qu'à
  // l'étape 4 de la séquence d'entrée (voir plus bas), tapé lettre par lettre.
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendHover, setSendHover] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Accroche : effet machine à écrire, lancé après la montée du personnage.
  const [typed, setTyped] = useState("");
  const [typing, setTyping] = useState(false);
  // Message de bienvenue en cours de frappe dans sa bulle (étape 4).
  const [greetingTyping, setGreetingTyping] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setConversationId(saved);
    } catch {
      /* localStorage indisponible */
    }
  }, [storageKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  // Séquence d'entrée, calée sur l'apparition du cadre (~2000 ms après le
  // chargement de l'iframe) :
  //   étape 1  0 ms      le cadre s'affiche vide (zoom, géré par widget.js)
  //   étape 2  +300 ms   le personnage se hisse (CSS .selvema-char, delay 2,3 s)
  //   étape 3  +300 ms   l'accroche s'écrit lettre par lettre (→ 2600 ms)
  //   étape 4  +300 ms   après la fin de l'accroche, la bulle de bienvenue
  //                      apparaît vide puis se remplit lettre par lettre
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let tagIv: ReturnType<typeof setInterval> | null = null;
    let msgIv: ReturnType<typeof setInterval> | null = null;
    const greetingChars = Array.from(greeting);

    // étape 3 — accroche
    timers.push(
      setTimeout(() => {
        setTyping(true);
        setTyped("");
        let i = 0;
        tagIv = setInterval(() => {
          i += 1;
          setTyped(fullTagline.slice(0, i));
          if (i < fullTagline.length) return;
          if (tagIv) clearInterval(tagIv);
          setTyping(false);

          // étape 4 — 300 ms après l'accroche : bulle vide, puis frappe
          timers.push(
            setTimeout(() => {
              // bulle vide en tête de conversation
              setMessages((prev) => [
                { role: "assistant", content: "" },
                ...prev,
              ]);
              timers.push(
                setTimeout(() => {
                  setGreetingTyping(true);
                  let j = 0;
                  msgIv = setInterval(() => {
                    j += 1;
                    const content = greetingChars.slice(0, j).join("");
                    setMessages((prev) => {
                      if (prev.length === 0) return prev;
                      const next = prev.slice();
                      next[0] = { role: "assistant", content };
                      return next;
                    });
                    if (j < greetingChars.length) return;
                    if (msgIv) clearInterval(msgIv);
                    setGreetingTyping(false);
                  }, 22);
                }, 260)
              );
            }, 300)
          );
        }, 50);
      }, 2600)
    );

    return () => {
      timers.forEach(clearTimeout);
      if (tagIv) clearInterval(tagIv);
      if (msgIv) clearInterval(msgIv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function closeWidget() {
    window.parent?.postMessage({ type: "selvema-widget-close" }, "*");
  }

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
        body: JSON.stringify({ clientId, conversationId, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");

      if (data.conversationId && data.conversationId !== conversationId) {
        setConversationId(data.conversationId);
        try {
          localStorage.setItem(storageKey, data.conversationId);
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

  // Découpe de l'accroche en cours de frappe sur les deux lignes.
  const nl = typed.indexOf("\n");
  const shown1 = nl === -1 ? typed : typed.slice(0, nl);
  const shown2 = nl === -1 ? "" : typed.slice(nl + 1);

  const rootStyle = {
    background: DARK_BG,
    color: "#fff",
    ["--sv-accent" as string]: accent,
  } as CSSProperties;

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={rootStyle}
    >
      {/* ── ZONE HAUTE (20 %) — personnage + accroche ─────────────────── */}
      {/* Fond noir pur pour se fondre avec le fond du PNG du personnage. */}
      <div
        className="relative shrink-0 overflow-hidden"
        style={{ flexBasis: "20%", minHeight: 96, background: "#000000" }}
      >
        {/* Personnage (image PNG) : occupe toute la hauteur de la zone, calé à
            gauche ; le bas déborde et est coupé par l'overflow de la zone.
            Montée gérée en CSS (.selvema-char). */}
        <div
          aria-hidden="true"
          className="selvema-char"
          style={{
            position: "absolute",
            left: 4,
            top: 0,
            bottom: 0,
            width: 104,
            pointerEvents: "none",
          }}
        >
          <Character />
        </div>

        {/* Accroche sur deux lignes */}
        <div
          className="absolute inset-y-0 flex flex-col justify-center"
          style={{ left: 116, right: 16, pointerEvents: "none" }}
        >
          <span
            style={{
              display: "block",
              minHeight: "1.12em",
              fontSize: 16,
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: "-0.01em",
              color: "#fff",
            }}
          >
            {shown1}
            {typing && nl === -1 && <span className="selvema-caret">|</span>}
          </span>
          {line2 && (
            <span
              style={{
                display: "block",
                minHeight: "1.12em",
                marginTop: 2,
                fontSize: 24,
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: "#fff",
              }}
            >
              {shown2}
              {typing && nl !== -1 && <span className="selvema-caret">|</span>}
            </span>
          )}
        </div>

        <button
          aria-label="Fermer"
          onClick={closeWidget}
          className="absolute right-1.5 top-1.5 text-white/70 transition-colors hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* ── Ligne de séparation (couleur principale) — le « mur » ─────── */}
      <div
        className="shrink-0"
        style={{
          height: 2,
          background: accent,
          boxShadow: `0 0 8px ${accent}`,
        }}
      />

      {/* ── ZONE BASSE (80 %) — conversation + saisie ─────────────────── */}
      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{ background: DARK_BG }}
      >
        <div
          ref={scrollRef}
          className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 py-3.5"
        >
          {messages.map((m, i) => {
            const isTypingBubble =
              greetingTyping && m.role === "assistant" && i === 0;
            return (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed"
                  style={
                    m.role === "user"
                      ? { backgroundColor: "rgba(255,255,255,0.1)", color: "#fff" }
                      : { backgroundColor: accent, color: "#fff" }
                  }
                >
                  {m.content}
                  {isTypingBubble && <span className="selvema-caret">|</span>}
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex justify-start">
              <div
                className="flex gap-1 rounded-2xl px-4 py-3"
                style={{ backgroundColor: hexToRgba(accent, 0.9) }}
              >
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 rounded-full bg-white/90 animate-pulse-dot"
                    style={{ animationDelay: `${d * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Saisie — 20 % du bas de la zone de conversation */}
        <div
          className="flex shrink-0 items-center gap-2 px-2.5"
          style={{
            flexBasis: "20%",
            minHeight: 58,
            maxHeight: 100,
            borderTop: `1px solid ${hexToRgba(accent, 0.3)}`,
          }}
        >
          <textarea
            rows={1}
            value={input}
            disabled={!ready}
            onChange={(e) => setInput(e.target.value)}
            onFocus={(e) => (e.currentTarget.style.borderColor = accent)}
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = hexToRgba(accent, 0.5))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={ready ? "Posez votre question…" : "Indisponible"}
            className="h-9 max-h-[72px] flex-1 resize-none rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-white/40 outline-none transition-colors"
            style={{
              background: "#050510",
              border: `1px solid ${hexToRgba(accent, 0.5)}`,
            }}
          />
          <button
            onClick={send}
            onMouseEnter={() => setSendHover(true)}
            onMouseLeave={() => setSendHover(false)}
            disabled={loading || !input.trim() || !ready}
            aria-label="Envoyer"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white transition-colors disabled:opacity-40"
            style={{
              backgroundColor: sendHover ? hexToRgba(accent, 0.85) : accent,
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 12l16-8-6 16-3-7-7-1z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
