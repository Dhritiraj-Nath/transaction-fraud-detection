import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Loader2,
  MapPin,
  Clock,
  CreditCard,
  Gauge,
} from "lucide-react";
import {
  SAMPLE_TRANSACTIONS,
  heuristicScore,
  riskBand,
  type Transaction,
} from "@/lib/transactions";
import { analyzeTransaction, type FraudAnalysis } from "@/lib/fraud.functions";

export const Route = createFileRoute("/")({
  component: FraudDashboard,
});

type Row = Transaction & { score: number; signals: string[] };

function bandStyles(band: ReturnType<typeof riskBand>) {
  switch (band) {
    case "critical":
      return { color: "var(--risk-critical)", label: "CRITICAL" };
    case "high":
      return { color: "var(--risk-high)", label: "HIGH" };
    case "medium":
      return { color: "var(--risk-medium)", label: "MEDIUM" };
    default:
      return { color: "var(--risk-low)", label: "LOW" };
  }
}

function FraudDashboard() {
  const rows: Row[] = useMemo(
    () =>
      SAMPLE_TRANSACTIONS.map((t) => {
        const { score, signals } = heuristicScore(t);
        return { ...t, score, signals };
      }).sort((a, b) => b.score - a.score),
    []
  );

  const [selected, setSelected] = useState<Row>(rows[0]);
  const [analysis, setAnalysis] = useState<FraudAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const analyze = useServerFn(analyzeTransaction);

  async function runAnalysis(row: Row) {
    setSelected(row);
    setAnalysis(null);
    setError(null);
    setLoading(true);
    try {
      const { transaction: _omit, score: _s, signals: _sg, ...rest } = {
        ...row,
      } as Row;
      void _omit;
      void _s;
      void _sg;
      const res = await analyze({ data: { transaction: rest as Transaction } });
      if (res.error) setError(res.error);
      else setAnalysis(res.analysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to analyze");
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const flagged = rows.filter((r) => r.score >= 55).length;
    const total = rows.length;
    const volume = rows.reduce((s, r) => s + r.amount, 0);
    const avgScore = Math.round(rows.reduce((s, r) => s + r.score, 0) / total);
    return { flagged, total, volume, avgScore };
  }, [rows]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 backdrop-blur sticky top-0 z-10 bg-background/80">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-lg grid place-items-center"
              style={{ background: "var(--gradient-ember)", boxShadow: "var(--shadow-ember)" }}
            >
              <ShieldAlert className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">SentryPay</h1>
              <p className="text-xs text-muted-foreground">
                AI Transaction Fraud Detection
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--risk-low)] animate-pulse" />
              Live monitoring
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Activity className="h-4 w-4" />}
            label="Transactions"
            value={stats.total.toString()}
          />
          <StatCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Flagged"
            value={stats.flagged.toString()}
            accent
          />
          <StatCard
            icon={<Gauge className="h-4 w-4" />}
            label="Avg risk score"
            value={`${stats.avgScore}`}
          />
          <StatCard
            icon={<CreditCard className="h-4 w-4" />}
            label="Volume"
            value={`$${stats.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                Live transactions
              </h2>
              <span className="text-xs text-muted-foreground">
                Sorted by risk
              </span>
            </div>
            <ul className="divide-y divide-border/50">
              {rows.map((r) => {
                const band = riskBand(r.score);
                const style = bandStyles(band);
                const isActive = r.id === selected.id;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => runAnalysis(r)}
                      className={`w-full text-left px-5 py-4 hover:bg-accent/40 transition-colors flex items-center gap-4 ${
                        isActive ? "bg-accent/30" : ""
                      }`}
                    >
                      <RiskRing score={r.score} color={style.color} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{r.merchant}</span>
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: style.color, color: "var(--primary-foreground)" }}
                          >
                            {style.label}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                          <span>{r.id}</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {r.city}, {r.country}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(r.timestamp).toUTCString().slice(17, 22)} UTC
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold tabular-nums">
                          ${r.amount.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">{r.cardholder}</div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <aside className="lg:col-span-2 rounded-xl border border-border/60 bg-card p-5 space-y-4 h-fit lg:sticky lg:top-24">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                  Case file
                </h2>
                <p className="font-semibold mt-1">{selected.id}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums">
                  ${selected.amount.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selected.merchant}
                </div>
              </div>
            </div>

            <Detail label="Cardholder" value={selected.cardholder} />
            <Detail label="Location" value={`${selected.city}, ${selected.country}`} />
            <Detail label="Channel" value={selected.channel} />
            <Detail
              label="Avg spend"
              value={`$${selected.avgAmount}  ·  ${selected.txnsLast10Min} txns / 10min`}
            />

            <div className="pt-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Heuristic signals
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selected.signals.length === 0 ? (
                  <span className="text-xs text-muted-foreground">None detected</span>
                ) : (
                  selected.signals.map((s) => (
                    <span
                      key={s}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border/60"
                    >
                      {s}
                    </span>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => runAnalysis(selected)}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-60"
              style={{ background: "var(--gradient-ember)", boxShadow: "var(--shadow-ember)" }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Analyze with AI
                </>
              )}
            </button>

            {error && (
              <div className="text-xs text-[var(--risk-critical)] border border-[var(--risk-critical)]/40 rounded-md p-2">
                {error}
              </div>
            )}

            {analysis && (
              <div className="space-y-3 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase text-muted-foreground font-semibold">
                    AI verdict
                  </span>
                  <VerdictBadge verdict={analysis.verdict} />
                </div>
                <div className="flex items-center gap-3">
                  <RiskRing score={analysis.riskScore} color={bandStyles(riskBand(analysis.riskScore)).color} large />
                  <div className="text-xs text-muted-foreground">
                    Confidence{" "}
                    <span className="text-foreground font-semibold">
                      {Math.round(analysis.confidence * 100)}%
                    </span>
                  </div>
                </div>
                <p className="text-sm leading-relaxed">{analysis.reasoning}</p>
                <div>
                  <div className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">
                    Detected signals
                  </div>
                  <ul className="space-y-1">
                    {analysis.signals.map((s, i) => (
                      <li key={i} className="text-xs flex gap-2">
                        <span className="text-primary">▸</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-md bg-secondary/60 border border-border/60 p-3 text-xs">
                  <div className="font-semibold mb-1 inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    Recommended action
                  </div>
                  {analysis.recommendedAction}
                </div>
              </div>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className="mt-2 text-2xl font-bold tabular-nums"
        style={accent ? { color: "var(--risk-high)" } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm border-b border-border/40 pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function RiskRing({
  score,
  color,
  large,
}: {
  score: number;
  color: string;
  large?: boolean;
}) {
  const size = large ? 64 : 44;
  const stroke = large ? 6 : 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--border)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <div
        className={`absolute inset-0 grid place-items-center font-bold tabular-nums ${
          large ? "text-lg" : "text-sm"
        }`}
        style={{ color }}
      >
        {score}
      </div>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: "approve" | "review" | "block" }) {
  const map = {
    approve: { c: "var(--risk-low)", t: "APPROVE" },
    review: { c: "var(--risk-medium)", t: "REVIEW" },
    block: { c: "var(--risk-critical)", t: "BLOCK" },
  } as const;
  const v = map[verdict];
  return (
    <span
      className="text-xs font-bold px-2 py-1 rounded"
      style={{ background: v.c, color: "var(--primary-foreground)" }}
    >
      {v.t}
    </span>
  );
}
