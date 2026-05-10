import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway";
import type { Transaction } from "./transactions";

const TxnSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  cardholder: z.string(),
  amount: z.number(),
  currency: z.string(),
  merchant: z.string(),
  category: z.string(),
  city: z.string(),
  country: z.string(),
  channel: z.enum(["in-store", "online", "atm"]),
  device: z.string().optional(),
  ipCountry: z.string().optional(),
  cardPresent: z.boolean(),
  avgAmount: z.number(),
  homeCountry: z.string(),
  txnsLast10Min: z.number(),
});

const ResultSchema = z.object({
  riskScore: z.number().min(0).max(100).describe("0=safe, 100=certain fraud"),
  verdict: z.enum(["approve", "review", "block"]),
  confidence: z.number().min(0).max(1),
  signals: z.array(z.string()).describe("Short fraud signals detected"),
  reasoning: z.string().describe("2-3 sentence plain-English explanation"),
  recommendedAction: z.string(),
});

export type FraudAnalysis = z.infer<typeof ResultSchema>;

export const analyzeTransaction = createServerFn({ method: "POST" })
  .inputValidator((input: { transaction: Transaction }) => ({
    transaction: TxnSchema.parse(input.transaction),
  }))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return {
        error: "AI gateway not configured",
        analysis: null as FraudAnalysis | null,
      };
    }

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const prompt = `You are a senior payments fraud analyst. Analyze this credit card transaction and return a structured fraud assessment.

Detection signals to consider:
- Unusual spending vs the cardholder's average
- Velocity (many transactions in a short window)
- Geographic anomalies (transaction country vs home country, IP mismatches, impossible travel)
- Off-hours activity
- High-risk merchant categories (gambling, crypto, jewelry, money transfer)
- Untrusted devices, missing card-present signal for high amounts

Transaction:
${JSON.stringify(data.transaction, null, 2)}

Return riskScore 0-100, verdict (approve <30, review 30-69, block >=70), 2-5 short signal strings, and clear reasoning a fraud analyst would write in a case file.`;

    try {
      const { experimental_output } = await generateText({
        model,
        prompt,
        experimental_output: Output.object({ schema: ResultSchema }),
      });
      return { error: null, analysis: experimental_output };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error("analyzeTransaction failed:", msg);
      return { error: msg, analysis: null as FraudAnalysis | null };
    }
  });