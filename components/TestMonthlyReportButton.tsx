"use client";

import { useState } from "react";

/**
 * Bouton de test interne : envoie tout de suite le bilan mensuel du client à
 * l'email du dirigeant (mois en cours, sans attendre le 1er). Objet préfixé
 * [TEST] côté destinataire.
 */
export default function TestMonthlyReportButton({
  clientId,
}: {
  clientId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/test-rapport`, {
        method: "POST",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Échec de l'envoi.");
      setMsg({
        ok: true,
        text: `Bilan de test envoyé à ${d.to} — ${d.month} : ${d.conversations} conversation(s), ${d.qualifiedLeads} lead(s), J+3 ${d.followup3}, J+7 ${d.followup7}.`,
      });
    } catch (err) {
      setMsg({
        ok: false,
        text: err instanceof Error ? err.message : "Échec de l'envoi.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-black p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white/80">Tests internes</h3>
          <p className="mt-0.5 text-xs text-white/40">
            Envoie le bilan mensuel de ce client au dirigeant, tout de suite,
            sans attendre le 1er du mois.
          </p>
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="shrink-0 rounded-full border border-[#882de1]/50 px-4 py-2 text-xs font-semibold text-white transition-colors hover:border-[#882de1] hover:bg-[#882de1]/15 disabled:opacity-40"
        >
          {busy ? "Envoi…" : "Tester le bilan mensuel"}
        </button>
      </div>
      {msg && (
        <p
          className={`mt-3 text-xs leading-snug ${
            msg.ok ? "text-[#22c55e]" : "text-red-400"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
