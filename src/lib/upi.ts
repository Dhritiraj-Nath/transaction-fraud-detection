export type UpiCheck = {
  upiId: string;
  amount: number;
  note?: string;
};

export type HeuristicResult = {
  score: number; // 0-100
  signals: string[];
};

// Known legitimate UPI provider handles (PSPs)
const KNOWN_PSPS = new Set([
  "oksbi", "okhdfcbank", "okicici", "okaxis",
  "ybl", "axl", "ibl", "upi",
  "paytm", "apl", "fbl", "kotak",
  "jio", "airtel", "boi", "pnb",
]);

const SCAM_KEYWORDS = [
  "kyc", "refund", "lottery", "prize", "verify", "otp",
  "support", "helpdesk", "officer", "police", "tax",
  "cashback", "reward", "loan", "urgent",
];

const SUSPICIOUS_NAME_PATTERNS = [
  /\d{6,}/,                    // 6+ digit run in name
  /(refund|kyc|support|help|verify|officer|admin|gov)/i,
  /^[a-z0-9]{20,}$/i,          // very long random handle
  /(.)\1{4,}/,                 // 5+ same char repeated
];

export function validateUpiId(upi: string): string | null {
  if (!upi) return "UPI ID is required";
  const trimmed = upi.trim();
  if (trimmed.length > 100) return "UPI ID too long";
  // basic shape: name@psp
  const re = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z][a-zA-Z0-9]{1,}$/;
  if (!re.test(trimmed)) return "Invalid UPI ID format (expected name@bank)";
  return null;
}

export function heuristicUpiScore({ upiId, amount, note }: UpiCheck): HeuristicResult {
  const signals: string[] = [];
  let score = 0;

  const [name = "", psp = ""] = upiId.toLowerCase().split("@");

  // PSP / handle reputation
  if (!KNOWN_PSPS.has(psp)) {
    signals.push(`Unknown UPI handle "@${psp}"`);
    score += 25;
  }

  for (const pat of SUSPICIOUS_NAME_PATTERNS) {
    if (pat.test(name)) {
      signals.push(`Suspicious name pattern in "${name}"`);
      score += 20;
      break;
    }
  }

  // Scam-keyword names
  const nameHasScamWord = SCAM_KEYWORDS.find((k) => name.includes(k));
  if (nameHasScamWord) {
    signals.push(`Name contains scam keyword: "${nameHasScamWord}"`);
    score += 30;
  }

  // Amount tiers
  if (amount >= 100000) {
    signals.push(`Very high amount (₹${amount.toLocaleString("en-IN")})`);
    score += 35;
  } else if (amount >= 25000) {
    signals.push(`High amount (₹${amount.toLocaleString("en-IN")})`);
    score += 18;
  } else if (amount >= 10000) {
    signals.push("Above-average amount");
    score += 8;
  }

  // Common scam amounts
  if ([1, 11, 111].includes(amount)) {
    signals.push("Tiny verification-style amount (often used to test stolen cards)");
    score += 10;
  }

  // Note analysis
  if (note) {
    const lower = note.toLowerCase();
    const hit = SCAM_KEYWORDS.find((k) => lower.includes(k));
    if (hit) {
      signals.push(`Note contains scam keyword: "${hit}"`);
      score += 25;
    }
    if (/(http|bit\.ly|tinyurl|wa\.me|t\.me)/i.test(note)) {
      signals.push("Note contains a link — uncommon for UPI payments");
      score += 15;
    }
  }

  return { score: Math.min(100, score), signals };
}

export function riskBand(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "medium";
  return "low";
}