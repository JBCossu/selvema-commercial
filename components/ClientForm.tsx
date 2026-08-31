"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import CopyButton from "@/components/CopyButton";

export type ClientFields = {
  agency_name: string;
  owner_email: string;
  owner_phone: string;
  site_url: string;
  chatbot_config: string;
  tagline: string;
  widget_color: string;
  active: boolean;
};

const DEFAULT_TAGLINE = "Une question ? Je suis là pour vous aider.";
const DEFAULT_COLOR = "#882de1";

const EMPTY: ClientFields = {
  agency_name: "",
  owner_email: "",
  owner_phone: "",
  site_url: "",
  chatbot_config: "",
  tagline: DEFAULT_TAGLINE,
  widget_color: DEFAULT_COLOR,
  active: true,
};

const HEX = /^#[0-9a-fA-F]{6}$/;

export default function ClientForm({
  mode,
  clientId,
  initial,
}: {
  mode: "create" | "edit";
  clientId?: string;
  initial?: Partial<ClientFields>;
}) {
  const router = useRouter();
  const [state, setState] = useState<ClientFields>({ ...EMPTY, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ id: string; snippet: string } | null>(
    null
  );

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  function set<K extends keyof ClientFields>(k: K, v: ClientFields[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }

  async function analyze() {
    if (!state.site_url.trim()) {
      setAnalyzeMsg({ ok: false, text: "Renseignez d'abord l'URL du site." });
      return;
    }
    setAnalyzing(true);
    setAnalyzeMsg(null);
    try {
      const res = await fetch("/api/clients/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: state.site_url }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Analyse impossible.");
      set("chatbot_config", d.config);
      setAnalyzeMsg({
        ok: true,
        text: "Configuration générée. Relisez-la et ajustez-la avant d'enregistrer.",
      });
    } catch (err) {
      setAnalyzeMsg({
        ok: false,
        text: err instanceof Error ? err.message : "Analyse impossible.",
      });
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const url = mode === "create" ? "/api/clients" : `/api/clients/${clientId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Échec de l'enregistrement.");

      if (mode === "create") {
        setCreated({ id: d.client.id, snippet: d.snippet });
      } else {
        router.push(`/client/${clientId}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <div className="rounded-2xl border border-[#22c55e]/50 bg-black p-6">
        <h2 className="text-lg font-semibold text-[#22c55e]">Client créé</h2>
        <p className="mt-2 text-sm text-white/70">
          Voici le script d'intégration unique de ce client. À coller sur son site,
          juste avant <code className="text-[#c39bf0]">&lt;/body&gt;</code>.
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs text-white/40">
            ID widget : <code className="text-[#c39bf0]">{created.id}</code>
          </span>
          <CopyButton text={created.snippet} />
        </div>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-[#882de1]/50 bg-[#0c0c14] p-4 text-sm text-[#c39bf0]">
          <code>{created.snippet}</code>
        </pre>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => router.push(`/client/${created.id}`)}
            className="btn-ghost"
          >
            Ouvrir la fiche client
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-white/60 transition-colors hover:text-white"
          >
            Retour au panneau de contrôle
          </button>
        </div>
      </div>
    );
  }

  const colorValue = HEX.test(state.widget_color)
    ? state.widget_color
    : DEFAULT_COLOR;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Coordonnées */}
      <section className="space-y-4 rounded-2xl border border-[#882de1] bg-black p-6">
        <h2 className="text-lg font-semibold">Coordonnées</h2>
        <Field label="Nom de l'agence *">
          <input
            required
            className="field"
            value={state.agency_name}
            onChange={(e) => set("agency_name", e.target.value)}
            placeholder="Agence Dupont Immobilier"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email du dirigeant *" hint="Reçoit les fiches prospects">
            <input
              required
              type="email"
              className="field"
              value={state.owner_email}
              onChange={(e) => set("owner_email", e.target.value)}
              placeholder="dirigeant@agence.fr"
            />
          </Field>
          <Field label="Téléphone du dirigeant" hint="Notifications">
            <input
              className="field"
              value={state.owner_phone}
              onChange={(e) => set("owner_phone", e.target.value)}
              placeholder="+33 6 12 34 56 78"
            />
          </Field>
        </div>
        {mode === "edit" && (
          <label className="flex items-center gap-3 text-sm text-white/80">
            <input
              type="checkbox"
              checked={state.active}
              onChange={(e) => set("active", e.target.checked)}
              className="h-4 w-4 accent-[#882de1]"
            />
            Client actif (le widget répond aux visiteurs)
          </label>
        )}
      </section>

      {/* Base de connaissances (analyse du site) */}
      <section className="space-y-4 rounded-2xl border border-[#882de1] bg-black p-6">
        <h2 className="text-lg font-semibold">Base de connaissances</h2>
        <p className="text-xs text-white/40">
          Ce qui est propre à ce client : description, services, zones, biens,
          FAQ. Le comportement de l'assistant (ton, qualification des prospects)
          est un prompt système fixe, commun à tous les clients.
        </p>

        <Field
          label="URL du site"
          hint="Selvema visite la page, en extrait le texte et génère la base de connaissances."
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              className="field flex-1"
              value={state.site_url}
              onChange={(e) => set("site_url", e.target.value)}
              placeholder="https://www.agence-dupont.fr"
            />
            <button
              type="button"
              onClick={analyze}
              disabled={analyzing}
              className="btn-ghost shrink-0 px-5"
            >
              {analyzing ? "Analyse…" : "Analyser le site"}
            </button>
          </div>
        </Field>

        {analyzeMsg && (
          <p
            className={`text-sm ${
              analyzeMsg.ok ? "text-[#22c55e]" : "text-red-400"
            }`}
          >
            {analyzeMsg.text}
          </p>
        )}

        <Field
          label="Base de connaissances de l'agence"
          hint="Généré par l'analyse du site, puis relu et modifiable librement avant enregistrement."
        >
          <textarea
            rows={18}
            className="field font-mono text-[13px] leading-relaxed"
            value={state.chatbot_config}
            onChange={(e) => set("chatbot_config", e.target.value)}
            placeholder={
              "## Description de l'agence\n…\n\n## Services\n- …\n\n## Zones couvertes\n…\n\n## Biens disponibles\n- …\n\n## FAQ probable\nQ : …\nR : …"
            }
          />
        </Field>
      </section>

      {/* Apparence du widget */}
      <section className="space-y-4 rounded-2xl border border-[#882de1] bg-black p-6">
        <h2 className="text-lg font-semibold">Apparence du widget</h2>
        <Field
          label="Phrase d'accroche"
          hint="Texte affiché dans la zone haute du widget (effet machine à écrire) et dans la barre réduite."
        >
          <input
            className="field"
            value={state.tagline}
            onChange={(e) => set("tagline", e.target.value)}
            placeholder={DEFAULT_TAGLINE}
          />
        </Field>
        <Field
          label="Couleur principale du widget"
          hint="Zone haute, ligne de séparation, personnage, messages de l'assistant, bouton d'envoi."
        >
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={colorValue}
              onChange={(e) => set("widget_color", e.target.value)}
              className="h-10 w-14 cursor-pointer rounded-lg border border-[#882de1]/50 bg-black p-1"
              aria-label="Sélecteur de couleur principale"
            />
            <input
              className="field max-w-[160px] font-mono"
              value={state.widget_color}
              onChange={(e) => set("widget_color", e.target.value)}
              placeholder={DEFAULT_COLOR}
            />
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: colorValue }}
            >
              Aperçu
            </span>
          </div>
        </Field>
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button type="submit" disabled={saving} className="btn-ghost">
        {saving
          ? "Enregistrement…"
          : mode === "create"
            ? "Créer le client"
            : "Enregistrer les modifications"}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-white/80">
        {label}
      </span>
      {hint && <span className="mb-2 block text-xs text-white/40">{hint}</span>}
      {children}
    </label>
  );
}
