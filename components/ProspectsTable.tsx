"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import type { Prospect } from "@/lib/db";

const STATUS_LABEL: Record<Prospect["status"], string> = {
  nouveau: "Nouveau",
  relance_j3_envoyee: "Relance J+3 envoyée",
  relance_j7_envoyee: "Relance J+7 envoyée",
  clos: "Clos",
};

const STATUS_COLOR: Record<Prospect["status"], string> = {
  nouveau: "text-[#c39bf0] border-[#882de1]",
  relance_j3_envoyee: "text-amber-300 border-amber-400/50",
  relance_j7_envoyee: "text-amber-200 border-amber-300/50",
  clos: "text-white/40 border-white/20",
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function nextFollowUp(p: Prospect): string {
  if (p.kind !== "qualifie" || p.status === "clos" || !p.email) return "—";
  const created = new Date(p.created_at).getTime();
  const day = 86400000;
  let due: number | null = null;
  if (!p.followup_3_sent_at) due = created + 3 * day;
  else if (!p.followup_7_sent_at) due = created + 7 * day;
  if (due === null) return "Terminé";
  const diff = Math.round((due - Date.now()) / day);
  if (diff <= 0) return "Imminente";
  return `Dans ${diff} j`;
}

export default function ProspectsTable({
  prospects: initial,
}: {
  prospects: Prospect[];
}) {
  const router = useRouter();
  const [prospects, setProspects] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function setStatus(id: string, status: Prospect["status"]) {
    setBusy(id);
    try {
      const res = await fetch(`/api/prospects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setProspects((list) =>
          list.map((p) => (p.id === id ? { ...p, status } : p))
        );
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  if (prospects.length === 0) {
    return (
      <div className="card text-center text-white/50">
        Aucun prospect pour l'instant. Les fiches apparaîtront ici dès que
        l'assistant en aura qualifié.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#882de1]">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="border-b border-[#882de1]/40 text-xs uppercase tracking-wider text-white/50">
          <tr>
            <th className="px-4 py-3 font-medium">Prospect</th>
            <th className="px-4 py-3 font-medium">Projet</th>
            <th className="px-4 py-3 font-medium">Contact</th>
            <th className="px-4 py-3 font-medium">Reçu le</th>
            <th className="px-4 py-3 font-medium">Prochaine relance</th>
            <th className="px-4 py-3 font-medium">Statut</th>
            <th className="px-4 py-3 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {prospects.map((p) => (
            <Fragment key={p.id}>
              <tr
                className="border-b border-white/5 align-top transition-colors hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3">
                  <button
                    onClick={() =>
                      setExpanded((e) => (e === p.id ? null : p.id))
                    }
                    className="text-left font-medium text-white hover:text-[#c39bf0]"
                  >
                    {p.name || "Sans nom"}
                  </button>
                  <div className="mt-0.5 text-xs text-white/40">
                    {p.kind === "rappel" ? "Demande de rappel" : "Qualifié"}
                  </div>
                </td>
                <td className="px-4 py-3 text-white/80">
                  {p.project_type || "—"}
                  {p.property_type ? ` · ${p.property_type}` : ""}
                  {p.location ? (
                    <div className="text-xs text-white/40">{p.location}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-white/70">
                  {p.email && <div>{p.email}</div>}
                  {p.phone && <div>{p.phone}</div>}
                  {!p.email && !p.phone && "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-white/60">
                  {fmtDate(p.created_at)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-white/70">
                  {nextFollowUp(p)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full border px-2.5 py-1 text-xs ${STATUS_COLOR[p.status]}`}
                  >
                    {STATUS_LABEL[p.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {p.status === "clos" ? (
                    <button
                      disabled={busy === p.id}
                      onClick={() => setStatus(p.id, "nouveau")}
                      className="text-xs text-white/50 hover:text-white"
                    >
                      Rouvrir
                    </button>
                  ) : (
                    <button
                      disabled={busy === p.id}
                      onClick={() => setStatus(p.id, "clos")}
                      className="text-xs text-white/70 hover:text-white"
                    >
                      Marquer comme traité
                    </button>
                  )}
                </td>
              </tr>
              {expanded === p.id && (
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <td colSpan={7} className="px-4 py-4">
                    <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                      {[
                        ["Budget", p.budget],
                        ["Type de bien", p.property_type],
                        ["Localisation", p.location],
                        ["Délai", p.timeline],
                        ["Situation", p.situation],
                      ].map(([k, v]) =>
                        v ? (
                          <div key={k} className="flex gap-2">
                            <dt className="text-white/40">{k} :</dt>
                            <dd className="text-white/80">{v}</dd>
                          </div>
                        ) : null
                      )}
                    </dl>
                    {p.summary && (
                      <p className="mt-3 rounded-lg border-l-2 border-[#882de1] bg-black/40 px-3 py-2 text-sm text-white/80">
                        {p.summary}
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
