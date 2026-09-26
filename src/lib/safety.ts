import type { SafetyLevel } from "./types";

// Deterministic first-pass screen (spec §16). The model is also instructed to
// flag concerns via a tool call; this catches explicit statements immediately,
// without depending on the model, so the UI can surface resources right away.
// It intentionally does not try to judge ambiguous cases like "I binged" —
// those go to the model, which can ask and weigh frequency and distress.

const CRISIS_PATTERNS: RegExp[] = [
  /\bsuicid(e|al)\b/i,
  /\bkill(ing)? myself\b/i,
  /\bend (my life|it all)\b/i,
  /\bwant(ed)? to die\b/i,
  /\b(hurt(ing)?|harm(ing)?|cut(ting)?) myself\b/i,
  /\bself[- ]harm/i,
  /\bno reason to (live|keep going)\b/i,
  /\bbetter off (dead|without me)\b/i,
];

const CONCERN_PATTERNS: RegExp[] = [
  /\bpurg(e|ed|ing)\b/i,
  /\bmake myself (throw up|sick|vomit|puke)\b/i,
  /\bmade myself (throw up|sick|vomit|puke)\b/i,
  /\b(throw|threw) up (on purpose|after (eating|meals?))\b/i,
  /\bself[- ]induced vomit/i,
  /\blaxatives?\b/i,
  /\bdiuretics?\b/i,
  /\bstarv(e|ed|ing) myself\b/i,
  /\bhaven'?t eaten (in|for) (\d+|two|three|four|five|several) days\b/i,
  /\bbinge(d|ing)? (every|almost every) (day|night)\b/i,
];

export function screenText(text: string): SafetyLevel {
  if (CRISIS_PATTERNS.some((p) => p.test(text))) return "crisis";
  if (CONCERN_PATTERNS.some((p) => p.test(text))) return "concern";
  return "none";
}

export function maxLevel(a: SafetyLevel, b: SafetyLevel): SafetyLevel {
  const rank: Record<SafetyLevel, number> = { none: 0, concern: 1, crisis: 2 };
  return rank[a] >= rank[b] ? a : b;
}

export interface SupportResource {
  name: string;
  detail: string;
  href?: string;
}

export const CRISIS_RESOURCES: SupportResource[] = [
  { name: "988 Suicide & Crisis Lifeline (US)", detail: "Call or text 988", href: "tel:988" },
  { name: "Crisis Text Line (US)", detail: "Text HOME to 741741", href: "sms:741741?body=HOME" },
  { name: "Outside the US", detail: "Contact your local emergency number or a local crisis line" },
];

export const EATING_SUPPORT_RESOURCES: SupportResource[] = [
  {
    name: "ANAD Eating Disorder Helpline (US)",
    detail: "Call 1-888-375-7767",
    href: "tel:18883757767",
  },
  {
    name: "Your doctor or a therapist",
    detail: "A professional who works with eating concerns can help you sort out what's going on",
  },
];
