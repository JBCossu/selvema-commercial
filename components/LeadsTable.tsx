"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import type { Lead } from "@/lib/db";

const DAY = 86400000;

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function followUpCell(lead: Lead, step: 3 | 7) {
  const sentAt = step === 3 ? lead.followup_3_sent_at : lead.followup_7_sent_at;
  if (sentAt) {
    return (
      <span className="text-[#22c55e]">Envoyée le {fmtDate(sentAt)}</span>
    );
  }
  if (lead.kind === "rappel") return <span className="text-white/30">—</span>;
  if (lead.status === "clos")
    return <span className="text-white/30">Annulée</span>;

  const due = new Date(lead.created_at).getTime() + step * DAY;
  if (step === 7 && !lead.followup_3_sent_at && Date.now() < due) {
    return <span className="text-white/40">En attente J+3</span>;
  }
  if (Date.now() >= due) {
    return <span className="text-amber-300">En attente d'envoi</span>;
  }
  return (
    <span className="text-white/50">Programmée le {fmtDate(new Date(due).toISOString())}</span>
  );
}

type TestMsg = { ok: boolean; text: string };

export default function LeadsTable({ leads: initial }: { leads: Lead[] }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  // Envoi de relance de test en cours ("<leadId>:<step>") et retour par lead.
  const [testing, setTesting] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<Record<string, TestMsg>>({});

  async function setStatus(id: string, status: Lead["status"]) {
    setBusy(id);
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setLeads((l) => l.map((x) => (x.id === id ? { ...x, status } : x)));
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  // Envoie tout de suite la relance J+3 / J+7 au prospect (test — n'attend pas
  // les délais réels et ne modifie pas l'état du lead).
  async function testRelance(id: string, step: 3 | 7) {
    setTesting(`${id}:${step}`);
    setTestMsg((m) => {
      const n = { ...m };
      delete n[id];
      return n;
    });
    try {
      const res = await fetch(`/api/leads/${id}/test-relance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Échec de l'envoi.");
      setTestMsg((m) => ({
        ...m,
        [id]: {
          ok: true,
          text: `Relance J+${step} envoyée à ${d.to} (test — lead inchangé).`,
        },
      }));
    } catch (err) {
      setTestMsg((m) => ({
        ...m,
        [id]: {
          ok: false,
          text: err instanceof Error ? err.message : "Échec de l'envoi.",
        },
      }));
    } finally {
      setTesting(null);
    }
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-2xl border border-[#882de1] bg-black p-8 text-center text-white/50">
        Aucun lead généré pour l'instant.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#882de1]">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="border-b border-[#882de1]/40 text-xs uppercase tracking-wider text-white/50">
          <tr>
            <th className="px-4 py-3 font-medium">Lead</th>
            <th className="px-4 py-3 font-medium">Contact</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Relance J+3</th>
            <th className="px-4 py-3 font-medium">Relance J+7</th>
            <th className="px-4 py-3 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <Fragment key={lead.id}>
              <tr className="border-b border-white/5 align-top transition-colors hover:bg-white/[0.03]">
                <td className="px-4 py-3">
                  <button
                    onClick={() =>
                      setOpen((o) => (o === lead.id ? null : lead.id))
                    }
                    className="text-left font-medium text-white hover:text-[#c39bf0]"
                  >
                    {lead.name || "Sans nom"}
                  </button>
                  <div className="mt-0.5 text-xs text-white/40">
                    {lead.kind === "rappel"
                      ? "Demande de rappel"
                      : lead.project_type || "Qualifié"}
                    {lead.status === "clos" ? " · clos" : ""}
                  </div>
                </td>
                <td className="px-4 py-3 text-white/70">
                  {lead.email && <div>{lead.email}</div>}
                  {lead.phone && <div>{lead.phone}</div>}
                  {!lead.email && !lead.phone && "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-white/60">
                  {fmtDate(lead.created_at)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {followUpCell(lead, 3)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {followUpCell(lead, 7)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-2">
                    {lead.status === "clos" ? (
                      <button
                        disabled={busy === lead.id}
                        onClick={() => setStatus(lead.id, "nouveau")}
                        className="text-left text-xs text-white/50 hover:text-white"
                      >
                        Rouvrir
                      </button>
                    ) : (
                      <button
                        disabled={busy === lead.id}
                        onClick={() => setStatus(lead.id, "clos")}
                        className="text-left text-xs text-white/70 hover:text-white"
                      >
                        Marquer traité
                      </button>
                    )}

                    {/* Boutons de test — envoi immédiat des relances */}
                    <div className="border-t border-dashed border-white/10 pt-2">
                      <div className="mb-1 text-[10px] uppercase tracking-wider text-white/30">
                        Test relances
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {([3, 7] as const).map((s) => (
                          <button
                            key={s}
                            disabled={!lead.email || testing === `${lead.id}:${s}`}
                            onClick={() => testRelance(lead.id, s)}
                            title={
                              lead.email
                                ? `Envoie tout de suite la relance J+${s} à ${lead.email}`
                                : "Ce lead n'a pas d'email"
                            }
                            className="whitespace-nowrap rounded-md border border-[#882de1]/40 px-2 py-1 text-[11px] text-white/70 transition-colors hover:border-[#882de1] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {testing === `${lead.id}:${s}`
                              ? "Envoi…"
                              : `Tester relance J+${s}`}
                          </button>
                        ))}
                      </div>
                      {testMsg[lead.id] && (
                        <p
                          className={`mt-1.5 max-w-[220px] text-[11px] leading-snug ${
                            testMsg[lead.id].ok
                              ? "text-[#22c55e]"
                              : "text-red-400"
                          }`}
                        >
                          {testMsg[lead.id].text}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
              {open === lead.id && (
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <td colSpan={6} className="px-4 py-4">
                    <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                      {[
                        ["Budget", lead.budget],
                        ["Type de bien", lead.property_type],
                        ["Localisation", lead.location],
                        ["Délai", lead.timeline],
                        ["Situation", lead.situation],
                      ].map(([k, v]) =>
                        v ? (
                          <div key={k} className="flex gap-2">
                            <dt className="text-white/40">{k} :</dt>
                            <dd className="text-white/80">{v}</dd>
                          </div>
                        ) : null
                      )}
                    </dl>
                    {lead.summary && (
                      <p className="mt-3 rounded-lg border-l-2 border-[#882de1] bg-black/40 px-3 py-2 text-sm text-white/80">
                        {lead.summary}
                      </p>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
