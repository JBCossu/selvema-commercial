import Link from "next/link";
import {
  FUNNEL_PERIODS,
  stageRate,
  type FunnelPeriod,
  type FunnelStage,
} from "@/lib/analytics";

/**
 * Funnel visuel : 5 étapes reliées par des flèches, taux de conversion entre
 * chaque étape. Sélecteur de période (liens `?period=`). Composant serveur :
 * les données sont recalculées à chaque chargement de la page.
 */
export default function AnalyticsFunnel({
  clientId,
  period,
  stages,
}: {
  clientId: string;
  period: FunnelPeriod;
  stages: FunnelStage[];
}) {
  return (
    <section
      id="analytique"
      className="mt-6 scroll-mt-6 rounded-2xl border border-[#882de1] bg-black p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Analytique</h2>
        <div className="flex flex-wrap gap-1.5">
          {FUNNEL_PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/client/${clientId}?period=${p.key}#analytique`}
              scroll={false}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                p.key === period
                  ? "bg-[#882de1] text-white"
                  : "border border-white/15 text-white/60 hover:border-[#882de1] hover:text-white"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        {stages.map((stage, i) => {
          const rate =
            i === 0 ? null : stageRate(stage.count, stages[i - 1].count);
          const isQualified = stage.key === "qualifies";
          return (
            <div
              key={stage.key}
              className="flex flex-col gap-2 sm:flex-1 sm:flex-row sm:items-stretch"
            >
              {i > 0 && (
                <div className="flex shrink-0 items-center justify-center gap-1.5 sm:flex-col sm:px-1">
                  <span className="text-lg leading-none text-white/25">
                    <span className="sm:hidden">↓</span>
                    <span className="hidden sm:inline">→</span>
                  </span>
                  <span className="rounded-full bg-[#882de1]/15 px-2 py-0.5 text-[11px] font-semibold text-[#c39bf0]">
                    {rate ?? "—"}
                  </span>
                </div>
              )}
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] px-3 py-4 text-center">
                <span
                  className={`text-3xl font-bold tabular-nums ${
                    isQualified ? "text-[#22c55e]" : "text-white"
                  }`}
                >
                  {stage.count}
                </span>
                <span className="mt-1 text-[11px] leading-tight text-white/50">
                  {stage.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-white/35">
        Chaque étape est un sous-ensemble de la précédente, à partir des
        conversations démarrées sur la période sélectionnée. Le pourcentage est
        le taux de passage d'une étape à la suivante.
      </p>
    </section>
  );
}
