import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway";

const InputSchema = z.object({
  upiId: z.string().min(3).max(100),
  amount: z.number().positive().max(10_000_000),
  note: z.string().max(280).optional(),
  heuristicScore: z.number().min(0).max(100),
  heuristicSignals: z.array(z.string()).max(20),
});

const ResultSchema = z.object({
  riskScore: z.number().min(0).max(100),
  verdict: z.enum(["safe", "review", "fraud"]),
  confidence: z.number().min(0).max(1),
  signals: z.array(z.string()),
  reasoning: z.string(),
  recommendedAction: z.string(),
});

export type FraudAnalysis = z.infer<typeof ResultSchema>;

export const analyzeUpi = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return { error: "AI gateway not configured", analysis: null as FraudAnalysis | null };
    }

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const prompt = `You are a senior UPI (India) payments fraud analyst. Decide if this UPI payment is likely a scam or fraud.

Common UPI fraud patterns to consider:
- Fake "KYC", "refund", "lottery", "cashback", "support" or "officer" UPI IDs
- Unknown / unofficial PSP handles (legitimate examples: @oksbi, @okhdfcbank, @ybl, @paytm, @okicici, @okaxis)
- Suspiciously high amounts, or tiny "verification" amounts (₹1, ₹11)
- Notes containing links, urgency, OTP requests, or scam keywords
- Random-looking long alphanumeric handles

Payment under review:
- UPI ID: ${data.upiId}
- Amount: ₹${data.amount}
- Note: ${data.note ?? "(none)"}

Heuristic pre-screening already produced:
- Score: ${data.heuristicScore}/100
- Signals: ${data.heuristicSignals.join("; ") || "none"}

Return riskScore 0-100, verdict (safe < 30, review 30-69, fraud >= 70), 2-5 short signals, plain-English reasoning a user can understand, and a clear recommendedAction (e.g. "Proceed", "Verify recipient by phone first", "Do not pay — report to bank").`;

    try {
      const { experimental_output } = await generateText({
        model,
        prompt,
        experimental_output: Output.object({ schema: ResultSchema }),
      });
      return { error: null, analysis: experimental_output as FraudAnalysis };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error("analyzeUpi failed:", msg);
      return { error: msg, analysis: null as FraudAnalysis | null };
    }
  });