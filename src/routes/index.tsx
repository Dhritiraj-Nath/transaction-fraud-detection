import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Loader2,
  AlertTriangle,
  IndianRupee,
  AtSign,
  StickyNote,
  History,
} from "lucide-react";
import {
  validateUpiId,
  heuristicUpiScore,
  riskBand,
} from "@/lib/upi";
import { analyzeUpi, type FraudAnalysis } from "@/lib/fraud.functions";

export const Route = createFileRoute("/")({
  component: UpiFraudCheck,
});

type HistoryEntry = {
  id: string;
  upiId: string;
  amount: number;
  note?: string;
  analysis: FraudAnalysis;
  at: number;
};

function bandStyle(band: ReturnType<typeof riskBand>) {
  switch (band) {
    case "critical":
      return { color: "var(--risk-critical)", label: "CRITICAL RISK" };
    case "high":
      return { color: "var(--risk-high)", label: "HIGH RISK" };
    case "medium":
      return { color: "var(--risk-medium)", label: "MEDIUM RISK" };
    default:
      return { color: "var(--risk-low)", label: "LOW RISK" };
  }
}

function UpiFraudCheck() {
  const [upiId, setUpiId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<FraudAnalysis | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const analyze = useServerFn(analyzeUpi);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const upiErr = validateUpiId(upiId);
    if (upiErr) {
      toast.error(upiErr);
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (amt > 10_000_000) {
      toast.error("Amount too high");
      return;
    }

    setLoading(true);
    setAnalysis(null);
    const heur = heuristicUpiScore({ upiId: upiId.trim(), amount: amt, note });

    try {
      const res = await analyze({
        data: {
          upiId: upiId.trim(),
          amount: amt,
          note: note || undefined,
          heuristicScore: heur.score,
          heuristicSignals: heur.signals,
        },
      });
      if (res.error || !res.analysis) {
        toast.error(res.error || "Analysis failed");
        return;
      }
      setAnalysis(res.analysis);
      setHistory((h) =>
        [
          {
            id: crypto.randomUUID(),
            upiId: upiId.trim(),
            amount: amt,
            note: note || undefined,
            analysis: res.analysis!,
            at: Date.now(),
          },
          ...h,
        ].slice(0, 8)
      );

      // Surface alert based on verdict
      if (res.analysis.verdict === "fraud") {
        toast.error("⚠️ Fraud detected — do NOT pay", {
          description: res.analysis.reasoning,
          duration: 10000,
        });
      } else if (res.analysis.verdict === "review") {
        toast.warning("Suspicious — verify before paying", {
          description: res.analysis.reasoning,
          duration: 8000,
        });
      } else {
        toast.success("Looks safe", { description: res.analysis.reasoning });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-lg grid place-items-center"
            style={{ background: "var(--gradient-ember)", boxShadow: "var(--shadow-ember)" }}
          >
            <ShieldAlert className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">SentryPay</h1>
            <p className="text-xs text-muted-foreground">UPI Fraud Detection</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 grid gap-8 lg:grid-cols-5">
        <section className="lg:col-span-3 space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Check a UPI payment before you pay
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter the recipient's UPI ID and amount. Our AI flags scams, fake
              handles, and suspicious requests in seconds.
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-border/60 bg-card p-6 space-y-4"
          >
            <Field label="UPI ID" icon={<AtSign className="h-4 w-4" />}>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. john@oksbi"
                autoComplete="off"
                maxLength={100}
                className="w-full bg-input/60 border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>

            <Field label="Amount (₹)" icon={<IndianRupee className="h-4 w-4" />}>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={10_000_000}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-input/60 border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring tabular-nums"
              />
            </Field>

            <Field label="Note (optional)" icon={<StickyNote className="h-4 w-4" />}>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What's this payment for?"
                maxLength={280}
                className="w-full bg-input/60 border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-60"
              style={{ background: "var(--gradient-ember)", boxShadow: "var(--shadow-ember)" }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Analyzing payment…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Check for fraud
                </>
              )}
            </button>
          </form>

          {analysis && <ResultCard analysis={analysis} />}
        </section>

        <aside className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <History className="h-4 w-4" /> Recent checks
          </div>
          {history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 p-6 text-xs text-muted-foreground text-center">
              No checks yet. Try one above.
            </div>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => {
                const s = bandStyle(riskBand(h.analysis.riskScore));
                return (
                  <li
                    key={h.id}
                    className="rounded-xl border border-border/60 bg-card p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">
                        {h.upiId}
                      </span>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                        style={{ background: s.color, color: "var(--primary-foreground)" }}
                      >
                        {h.analysis.verdict.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground tabular-nums">
                      <span>₹{h.amount.toLocaleString("en-IN")}</span>
                      <span>Risk {h.analysis.riskScore}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </main>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5 mb-1.5">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

function ResultCard({ analysis }: { analysis: FraudAnalysis }) {
  const band = riskBand(analysis.riskScore);
  const s = bandStyle(band);
  const isFraud = analysis.verdict === "fraud";
  const isReview = analysis.verdict === "review";

  return (
    <div
      className="rounded-2xl border bg-card p-6 space-y-5"
      style={{
        borderColor: isFraud || isReview ? s.color : "var(--border)",
        boxShadow: isFraud ? "var(--shadow-ember)" : undefined,
      }}
    >
      <div className="flex items-start gap-4">
        <RiskRing score={analysis.riskScore} color={s.color} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {isFraud ? (
              <AlertTriangle className="h-4 w-4" style={{ color: s.color }} />
            ) : isReview ? (
              <ShieldAlert className="h-4 w-4" style={{ color: s.color }} />
            ) : (
              <ShieldCheck className="h-4 w-4" style={{ color: s.color }} />
            )}
            <span
              className="text-xs font-bold tracking-wider"
              style={{ color: s.color }}
            >
              {s.label}
            </span>
          </div>
          <h3 className="text-xl font-bold mt-1">
            {isFraud
              ? "Don't pay — likely fraud"
              : isReview
              ? "Verify before paying"
              : "Looks safe to pay"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Confidence{" "}
            <span className="font-semibold text-foreground">
              {Math.round(analysis.confidence * 100)}%
            </span>
          </p>
        </div>
      </div>

      <p className="text-sm leading-relaxed">{analysis.reasoning}</p>

      {analysis.signals.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">
            Detected signals
          </div>
          <div className="flex flex-wrap gap-1.5">
            {analysis.signals.map((sig, i) => (
              <span
                key={i}
                className="text-[11px] px-2 py-1 rounded-full bg-secondary text-secondary-foreground border border-border/60"
              >
                {sig}
              </span>
            ))}
          </div>
        </div>
      )}

      <div
        className="rounded-lg p-3 text-sm border"
        style={{
          borderColor: s.color,
          background: `color-mix(in oklab, ${s.color} 10%, transparent)`,
        }}
      >
        <div className="text-xs font-semibold uppercase mb-1" style={{ color: s.color }}>
          Recommended action
        </div>
        {analysis.recommendedAction}
      </div>
    </div>
  );
}

function RiskRing({ score, color }: { score: number; color: string }) {
  const size = 64;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border)" strokeWidth={stroke} fill="none" />
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
        className="absolute inset-0 grid place-items-center text-lg font-bold tabular-nums"
        style={{ color }}
      >
        {score}
      </div>
    </div>
  );
}