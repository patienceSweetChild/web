export type PipelineStatus =
  | "new"
  | "audit"
  | "proposal"
  | "follow_up"
  | "won"
  | "lost"
  | "paused";

export const PIPELINE_OPTIONS: { value: PipelineStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "audit", label: "Audit" },
  { value: "proposal", label: "Proposal" },
  { value: "follow_up", label: "Follow-up" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "paused", label: "Paused" },
];

export type ShortlistItemSource = "manual" | "ai" | "recommend" | "starter";

export type AudienceStage = "S1" | "S2" | "S3" | "S4" | "S5";

export type OnboardingDiagnosis = {
  goal?: string | null;
  problemIds?: string[];
  audience?: AudienceStage | null;
  cta?: string | null;
  channel?: string | null;
  expectedClient?: string | null;
};

export type ClientPinShortlist = {
  id: string;
  client_id: string;
  created_by: string;
  diagnosis: OnboardingDiagnosis;
  created_at: string;
  updated_at: string;
};

export type ClientPinShortlistItem = {
  id: string;
  shortlist_id: string;
  pin_id: string;
  source: ShortlistItemSource;
  added_by: string | null;
  created_at: string;
};

export type OnboardingChatMessage = {
  id: string;
  thread_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type ProjectItem = {
  id: string;
  project_id: string;
  pin_id: string;
  sort_order: number;
  added_by: string | null;
  created_at: string;
};

/** Format kanban columns for Recommended Pins / project overview. */
export const FORMAT_COLUMNS = [
  { id: "videos", label: "VIDEO ADS", color: "#0747a6" },
  { id: "images", label: "IMAGE ADS", color: "#ffab00" },
  { id: "print", label: "PRINT", color: "#ff5630" },
  { id: "web", label: "WEB", color: "#00b8d9" },
  { id: "online_selling", label: "ONLINE SELLING", color: "#36b37e" },
  { id: "automation", label: "AUTOMATION", color: "#6554c0" },
] as const;

export type FormatColumnId = (typeof FORMAT_COLUMNS)[number]["id"];

export const AUDIENCE_STAGES: { id: AudienceStage; label: string }[] = [
  { id: "S1", label: "S1 Unaware" },
  { id: "S2", label: "S2 Problem Aware" },
  { id: "S3", label: "S3 Solution Aware" },
  { id: "S4", label: "S4 Product Aware" },
  { id: "S5", label: "S5 Most Aware" },
];

export const CTA_OPTIONS = [
  "Buy Now",
  "Book a Call",
  "Get Quote",
  "Learn More",
  "Sign Up",
  "WhatsApp",
];

export const CHANNEL_OPTIONS = [
  "All formats",
  "Video Ads",
  "Image Ads",
  "Print",
  "Web",
  "Online Selling",
  "Automation",
];
