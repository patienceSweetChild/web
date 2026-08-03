export type PinColumn = "videos" | "images" | "print" | "web" | "automation";
export type PinBranch = "Ads" | "Print" | "Web" | "Online Selling" | "Automation";
export type PinStatus = "Published" | "Draft" | "Archived" | "Active";

export type FormatKey = "video" | "image" | "print" | "web";

export type FormatMetrics = {
  hooks: number;
  angles: number;
  executions: number;
  assets: number;
};

export type Pin = {
  id: string;
  name: string;
  subtype: string;
  branch: PinBranch | string;
  column: PinColumn | string;
  price: string;
  lower: string;
  higher: string;
  PM: boolean;
  status: string;
  tags: string[];
  displayTags: string[];
  notes: string;
  expectedClient: string[];
  selling: string[];
  creativePack: string[];
  fullCampaign: string[];
  talent?: string[];
  problems?: string[];
  hooks: number;
  angles: number;
  executions: number;
  assets: number;
  formatAssets?: Partial<Record<FormatKey, number | FormatMetrics>>;
  formatPacks?: Partial<Record<FormatKey, FormatMetrics & Record<string, unknown>>>;
  stage: number;
  footerLabel: string;
  showColumnChip?: boolean;
};

export type Problem = {
  id: string;
  title: string;
  label: string;
  letter: string;
  expectedClient: string[];
};

export type Catalogs = {
  expectedClients: string[];
  sellingOptions: string[];
  creativePackOptions: string[];
  fullCampaignOptions: string[];
  talentOptions: string[];
};

export type PinsData = Catalogs & {
  pins: Pin[];
};

export type ProblemsData = {
  problems: Problem[];
};

/** Board surface identifiers (routes + shell mode). */
export type BoardId =
  | "catalog"
  | "formats"
  | "clients"
  | "sell-channels"
  | "creative-packs"
  | "problems";

/** @deprecated Use BoardId — kept temporarily for migration clarity */
export type BoardMode = BoardId;

export type NormalizedStatus = "Draft" | "Archived" | "Active";

export type TagCategory =
  | "expectedClient"
  | "selling"
  | "creativePack"
  | "fullCampaign"
  | "talent"
  | "problems";

export type PinTagField = "expectedClient" | "selling" | "creativePack";
