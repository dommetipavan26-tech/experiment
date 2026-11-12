const env = import.meta.env;
const isTest = env.MODE === "test" || env.VITEST === "true" || env.VITEST === true;

export const CONFIG = {
  supabaseUrl: (env.VITE_SUPABASE_URL as string | undefined) ?? "",
  supabaseKey: (env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "",
  githubRepo: (env.VITE_GITHUB_REPO as string | undefined) ?? "dommetipavan26-tech/experiment",
  linearTeamKey: (env.VITE_LINEAR_TEAM_KEY as string | undefined) ?? "PAV",
  qaReviewer: (env.VITE_QA_REVIEWER as string | undefined) ?? "Pavan Dommeti",
  productionUrl:
    (env.VITE_PRODUCTION_URL as string | undefined) ?? "https://relay-live-ops.vercel.app",
  get edgeBase() {
    return this.supabaseUrl ? `${this.supabaseUrl}/functions/v1` : "";
  },
  get isLive() {
    return !isTest && !!(this.supabaseUrl && this.supabaseKey);
  },
} as const;

export const CONSTANTS = {
  version: "1.1.0",
  projectRef: "txbgovhxqxvlioszevbe",
  vercelProject: "relay-live-ops",
  linearProjectUrl:
    "https://linear.app/pavan-dommeti/project/relay-live-civic-operations-7a714c17167b",
  linearQaIssueUrl:
    "https://linear.app/pavan-dommeti/issue/PAV-11/qa-sign-off-relay-11-verification-and-tester-assignment",
  githubUrl: `https://github.com/${CONFIG.githubRepo}`,
  region: "Amaravati Capital Region",
  qaSuite: "Vitest · GitHub Actions CI",
  qaChecks: [
    "Formatting and time utilities",
    "Seed data integrity",
    "Demo store actions and cross-tab sync",
    "Component rendering and accessibility",
    "GitHub commit mapping",
    "Typecheck and production build",
  ],
  districts: ["Amaravati", "Guntur", "NTR", "Krishna", "Prakasam"] as const,
  categories: [
    "power",
    "water",
    "traffic",
    "weather",
    "network",
    "safety",
    "other",
  ] as const,
  roles: ["Duty operator", "Dispatcher", "Field responder", "QA tester", "Observer"] as const,
};
