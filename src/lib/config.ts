const env = import.meta.env;

export const CONFIG = {
  supabaseUrl: (env.VITE_SUPABASE_URL as string | undefined) ?? "",
  supabaseKey: (env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "",
  githubRepo: (env.VITE_GITHUB_REPO as string | undefined) ?? "dommetipavan26-tech/experiment",
  linearTeamKey: (env.VITE_LINEAR_TEAM_KEY as string | undefined) ?? "PAV",
  productionUrl:
    (env.VITE_PRODUCTION_URL as string | undefined) ?? "https://relay-live-ops.vercel.app",
  get edgeBase() {
    return this.supabaseUrl ? `${this.supabaseUrl}/functions/v1` : "";
  },
  get isLive() {
    return !!(this.supabaseUrl && this.supabaseKey);
  },
} as const;

export const CONSTANTS = {
  projectRef: "txbgovhxqxvlioszevbe",
  vercelProject: "relay-live-ops",
  linearProjectUrl:
    "https://linear.app/pavan-dommeti/project/relay-live-civic-operations-7a714c17167b",
  githubUrl: `https://github.com/${CONFIG.githubRepo}`,
  region: "Amaravati Capital Region",
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
  roles: ["Duty operator", "Dispatcher", "Field responder", "Observer"] as const,
};
