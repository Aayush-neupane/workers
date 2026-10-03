import type { PricingModel } from "./types";

export const PRICING_LABELS: Record<PricingModel, string> = {
  fixed: "Fixed price",
  starting: "Starting price",
  hourly: "Hourly rate",
  "inspection-quote": "Inspection + quote",
  "custom-quote": "Custom quote",
};

export const PRICING_EXPLAINERS: Record<PricingModel, string> = {
  fixed: "You pay exactly this. If the job needs more work, the pro must get your approval first.",
  starting: "Final price depends on the job size. The pro confirms the exact amount with you on site before starting.",
  hourly: "Billed per hour on site, rounded to the half hour. The estimate shows the typical duration.",
  "inspection-quote": "Pay a small inspection fee. You then receive a fixed quote and approve it before any work begins.",
  "custom-quote": "Every job is scoped individually. You approve a written quote before work begins — no surprises.",
};
