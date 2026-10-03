export interface CategoryInfo {
  name: string;
  color: string;
  emoji: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { name: "Groceries", color: "#16a34a", emoji: "🛒" },
  { name: "Dining", color: "#f97316", emoji: "🍽️" },
  { name: "Transport", color: "#0284c7", emoji: "🚗" },
  { name: "Housing", color: "#7c3aed", emoji: "🏠" },
  { name: "Utilities", color: "#0891b2", emoji: "💡" },
  { name: "Subscriptions", color: "#db2777", emoji: "🔁" },
  { name: "Shopping", color: "#ca8a04", emoji: "🛍️" },
  { name: "Entertainment", color: "#e11d48", emoji: "🎬" },
  { name: "Health", color: "#14b8a6", emoji: "💊" },
  { name: "Travel", color: "#4f46e5", emoji: "✈️" },
  { name: "Insurance", color: "#64748b", emoji: "🛡️" },
  { name: "Education", color: "#9333ea", emoji: "🎓" },
  { name: "Personal", color: "#c026d3", emoji: "💈" },
  { name: "Giving", color: "#ea580c", emoji: "🎁" },
  { name: "Fees", color: "#dc2626", emoji: "🏦" },
  { name: "Other", color: "#78716c", emoji: "📦" },
  { name: "Income", color: "#059669", emoji: "💵" },
  { name: "Transfer", color: "#94a3b8", emoji: "🔄" },
];

export const SPEND_CATEGORIES = CATEGORIES.filter((c) => c.name !== "Income" && c.name !== "Transfer");

const byName = new Map(CATEGORIES.map((c) => [c.name, c]));
export const categoryInfo = (name: string): CategoryInfo => byName.get(name) ?? byName.get("Other")!;

const TRANSFER = /\b(transfer|xfer|autopay|auto pay|payment\W*thank you|credit card (pmt|payment)|card payment|payment received)\b/i;

// Order matters: first match wins.
const RULES: [string, RegExp][] = [
  ["Subscriptions", /\b(netflix|spotify|hulu|disney\s?\+|disneyplus|hbo|max\.com|apple\.com\/bill|icloud|youtube\s?(premium|tv)|patreon|adobe|github|openai|chatgpt|audible|dropbox|prime video|subscription|substack|nytimes|paramount|peacock)/i],
  ["Dining", /\b(restaurant|cafe|café|coffee|starbucks|dunkin|mcdonald|burger|pizza|chipotle|doordash|uber\s?eats|ubereats|grubhub|taco|subway|sushi|bakery|deli|diner|pub|bar & grill|kitchen|grill|bistro|wendy|chick-fil-a|panera|domino|kfc|shake shack|instacart restaurant|takeout)/i],
  ["Groceries", /\b(kroger|safeway|trader joe|whole foods|aldi|costco|publix|wegmans|tesco|sainsbury|lidl|grocery|groceries|supermarket|h-?e-?b|meijer|food lion|sprouts|woolworths|coles|market basket|instacart|stop & shop|giant eagle|fresh market)/i],
  ["Transport", /\b(uber|lyft|shell|chevron|exxon|mobil|bp|gas|fuel|parking|transit|metro|mta|toll|taxi|speedway|sunoco|citgo|wawa|clipper|bart|oyster|tfl|zipcar)\b/i],
  ["Housing", /\b(rent|mortgage|hoa|landlord|property mgmt|property management|apartment|lease)\b/i],
  ["Utilities", /\b(electric|electricity|water|utility|utilities|internet|comcast|xfinity|verizon|at&t|att|t-mobile|spectrum|pg&e|con ?ed|phone|wireless|sewer|trash|duke energy|national grid)\b/i],
  ["Travel", /\b(airline|airlines|delta|united air|southwest|american air|jetblue|airbnb|hotel|marriott|hilton|booking\.com|expedia|amtrak|flight|hostel|vrbo)\b/i],
  ["Insurance", /\b(insurance|geico|state farm|progressive|allstate|liberty mutual)\b/i],
  ["Health", /\b(pharmacy|cvs|walgreens|rite aid|clinic|hospital|dental|dentist|doctor|medical|gym|fitness|planet fitness|optical|vision|health|therapy|physio|urgent care|labcorp|quest diag)\b/i],
  ["Entertainment", /\b(cinema|movie|movies|amc|theater|theatre|steam|playstation|xbox|nintendo|ticketmaster|concert|bowling|arcade|stubhub|museum|zoo)\b/i],
  ["Education", /\b(tuition|university|college|school|coursera|udemy|textbook|bookstore|student loan|skillshare)\b/i],
  ["Personal", /\b(salon|barber|spa|haircut|laundry|dry clean|nail|waxing|sephora|ulta)\b/i],
  ["Giving", /\b(donation|charity|gofundme|church|red cross|unicef|tithe)\b/i],
  ["Fees", /\b(fee|fees|overdraft|interest charge|atm|service charge|late charge|finance charge)\b/i],
  ["Shopping", /\b(amazon|amzn|target|walmart|ebay|etsy|best buy|ikea|home depot|lowe'?s|nike|zara|h&m|old navy|apple store|macy'?s|nordstrom|tj ?maxx|marshalls|kohl'?s|wayfair|shein|gap|uniqlo|dollar tree|big lots|michaels|staples|online|shop|store)\b/i],
];

/** Stable key for "this merchant", used to remember the user's category choices. */
export function merchantKey(description: string): string {
  const words = description
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
  return words.slice(0, 2).join(" ") || description.toLowerCase().trim();
}

export function categorize(description: string, amount: number, userRules: Record<string, string> = {}): string {
  const remembered = userRules[merchantKey(description)];
  if (remembered) return remembered;
  if (TRANSFER.test(description)) return "Transfer";
  if (amount > 0) return "Income";
  for (const [cat, rx] of RULES) if (rx.test(description)) return cat;
  return "Other";
}
