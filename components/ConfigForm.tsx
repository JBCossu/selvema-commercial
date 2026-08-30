"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { AgencyConfig } from "@/lib/db";

type State = {
  agency_name: string;
  owner_email: string;
  owner_phone: string;
  description: string;
  faq: string;
  properties: string;
};

const EMPTY: State = {
  agency_name: "",
  owner_email: "",
  owner_phone: "",
  description: "",
  faq: "",
  properties: "",
};

export default function ConfigForm() {
  const [state, setState] = useState<State>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d: { config: AgencyConfig | null }) => {
        if (d.config) {
          setState({
            agency_name: d.config.agency_name ?? "",
            owner_email: d.config.owner_email ?? "",
            owner_phone: d.config.owner_phone ?? "",
            description: d.config.description ?? "",
            faq: d.config.faq ?? "",
            properties: d.config.properties ?? "",
          });
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  function set<K extends keyof State>(k: K, v: string) {
    setState((s) => ({ ...s, [k]: v }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Échec de l'enregistrement.");
      setMessage({ ok: true, text: "Base de connaissances enregistrée." });
    } catch (err) {
      setMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Une erreur est survenue.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return <p className="text-white/50">Chargement…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="card space-y-4">
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
          <Field label="Téléphone du dirigeant" hint="Pour les notifications SMS">
            <input
              className="field"
              value={state.owner_phone}
              onChange={(e) => set("owner_phone", e.target.value)}
              placeholder="+33 6 12 34 56 78"
            />
          </Field>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Base de connaissances</h2>
        <Field
          label="Description de l'agence"
          hint="Zones couvertes, types de biens, fonctionnement, honoraires, équipe…"
        >
          <textarea
            rows={6}
            className="field"
            value={state.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Nous couvrons Lyon 3e, 6e et 7e. Spécialisés en appartements anciens et investissement locatif. Honoraires vendeur…"
          />
        </Field>
        <Field
          label="FAQ de l'agence"
          hint="Une question par bloc, suivie de sa réponse"
        >
          <textarea
            rows={8}
            className="field"
            value={state.faq}
            onChange={(e) => set("faq", e.target.value)}
            placeholder={
              "Q : Proposez-vous des estimations gratuites ?\nR : Oui, sous 48h après visite.\n\nQ : Gérez-vous la location ?\nR : Oui, gestion locative complète."
            }
          />
        </Field>
        <Field
          label="Biens disponibles"
          hint="Liste simple, un bien par ligne avec une courte description"
        >
          <textarea
            rows={8}
            className="field"
            value={state.properties}
            onChange={(e) => set("properties", e.target.value)}
            placeholder={
              "- T3 68 m², Lyon 7e, 285 000 €, balcon, proche métro Jean Macé.\n- Maison 110 m², Vénissieux, 340 000 €, 4 chambres, jardin 300 m²."
            }
          />
        </Field>
      </section>

      {message && (
        <p
          className={`text-sm ${message.ok ? "text-[#22c55e]" : "text-red-400"}`}
        >
          {message.text}
        </p>
      )}

      <button type="submit" disabled={saving} className="btn-ghost">
        {saving ? "Enregistrement…" : "Enregistrer la configuration"}
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
