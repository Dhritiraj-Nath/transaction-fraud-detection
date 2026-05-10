export type Transaction = {
  id: string;
  timestamp: string; // ISO
  cardholder: string;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  city: string;
  country: string;
  channel: "in-store" | "online" | "atm";
  device?: string;
  ipCountry?: string;
  cardPresent: boolean;
  // user baseline context
  avgAmount: number;
  homeCountry: string;
  txnsLast10Min: number;
};

export const SAMPLE_TRANSACTIONS: Transaction[] = [
  {
    id: "TXN-10293",
    timestamp: "2026-05-10T03:42:00Z",
    cardholder: "A. Mehta",
    amount: 4280.0,
    currency: "USD",
    merchant: "LuxuryWatchHub",
    category: "Jewelry",
    city: "Lagos",
    country: "NG",
    channel: "online",
    device: "Unknown Android",
    ipCountry: "NG",
    cardPresent: false,
    avgAmount: 64,
    homeCountry: "US",
    txnsLast10Min: 4,
  },
  {
    id: "TXN-10294",
    timestamp: "2026-05-10T08:15:00Z",
    cardholder: "S. Chen",
    amount: 12.5,
    currency: "USD",
    merchant: "Blue Bottle Coffee",
    category: "Food & Drink",
    city: "San Francisco",
    country: "US",
    channel: "in-store",
    cardPresent: true,
    avgAmount: 18,
    homeCountry: "US",
    txnsLast10Min: 1,
  },
  {
    id: "TXN-10295",
    timestamp: "2026-05-10T02:11:00Z",
    cardholder: "J. Romero",
    amount: 899.0,
    currency: "USD",
    merchant: "CryptoPeer",
    category: "Crypto Exchange",
    city: "Bucharest",
    country: "RO",
    channel: "online",
    device: "Tor Browser",
    ipCountry: "RO",
    cardPresent: false,
    avgAmount: 120,
    homeCountry: "ES",
    txnsLast10Min: 7,
  },
  {
    id: "TXN-10296",
    timestamp: "2026-05-10T13:02:00Z",
    cardholder: "E. Kowalski",
    amount: 56.2,
    currency: "USD",
    merchant: "Whole Foods",
    category: "Groceries",
    city: "Boston",
    country: "US",
    channel: "in-store",
    cardPresent: true,
    avgAmount: 72,
    homeCountry: "US",
    txnsLast10Min: 1,
  },
  {
    id: "TXN-10297",
    timestamp: "2026-05-10T04:55:00Z",
    cardholder: "A. Mehta",
    amount: 1500.0,
    currency: "USD",
    merchant: "ATM Withdrawal",
    category: "ATM",
    city: "Tokyo",
    country: "JP",
    channel: "atm",
    cardPresent: true,
    avgAmount: 64,
    homeCountry: "US",
    txnsLast10Min: 2,
  },
  {
    id: "TXN-10298",
    timestamp: "2026-05-10T11:24:00Z",
    cardholder: "M. Patel",
    amount: 220.0,
    currency: "USD",
    merchant: "Amazon",
    category: "Retail",
    city: "Austin",
    country: "US",
    channel: "online",
    device: "iPhone (known)",
    ipCountry: "US",
    cardPresent: false,
    avgAmount: 180,
    homeCountry: "US",
    txnsLast10Min: 1,
  },
  {
    id: "TXN-10299",
    timestamp: "2026-05-10T01:08:00Z",
    cardholder: "L. Dubois",
    amount: 3199.0,
    currency: "USD",
    merchant: "BetKing Casino",
    category: "Gambling",
    city: "Manila",
    country: "PH",
    channel: "online",
    device: "Unknown Windows",
    ipCountry: "PH",
    cardPresent: false,
    avgAmount: 90,
    homeCountry: "FR",
    txnsLast10Min: 9,
  },
  {
    id: "TXN-10300",
    timestamp: "2026-05-10T19:40:00Z",
    cardholder: "R. Thompson",
    amount: 38.99,
    currency: "USD",
    merchant: "Netflix",
    category: "Subscriptions",
    city: "Chicago",
    country: "US",
    channel: "online",
    device: "Apple TV (known)",
    ipCountry: "US",
    cardPresent: false,
    avgAmount: 45,
    homeCountry: "US",
    txnsLast10Min: 1,
  },
];

export function heuristicScore(t: Transaction): {
  score: number;
  signals: string[];
} {
  const signals: string[] = [];
  let score = 0;

  if (t.amount > t.avgAmount * 8) {
    signals.push(`Amount ${(t.amount / t.avgAmount).toFixed(1)}× user average`);
    score += 35;
  } else if (t.amount > t.avgAmount * 3) {
    signals.push("Above typical spend");
    score += 15;
  }

  if (t.country !== t.homeCountry) {
    signals.push(`Foreign country (${t.country} vs home ${t.homeCountry})`);
    score += 20;
  }
  if (t.ipCountry && t.ipCountry !== t.homeCountry) {
    signals.push(`IP geolocated to ${t.ipCountry}`);
    score += 10;
  }

  if (t.txnsLast10Min >= 5) {
    signals.push(`Velocity: ${t.txnsLast10Min} txns in 10 min`);
    score += 25;
  } else if (t.txnsLast10Min >= 3) {
    signals.push("Elevated velocity");
    score += 10;
  }

  const hour = new Date(t.timestamp).getUTCHours();
  if (hour >= 1 && hour <= 5) {
    signals.push(`Off-hours activity (${hour}:00 UTC)`);
    score += 8;
  }

  const risky = ["Gambling", "Crypto Exchange", "Jewelry"];
  if (risky.includes(t.category)) {
    signals.push(`High-risk merchant category: ${t.category}`);
    score += 12;
  }

  if (t.device?.toLowerCase().includes("unknown") || t.device?.toLowerCase().includes("tor")) {
    signals.push(`Untrusted device: ${t.device}`);
    score += 12;
  }

  return { score: Math.min(100, score), signals };
}

export function riskBand(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "medium";
  return "low";
}