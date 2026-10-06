import {
  Droplet,
  Hammer,
  Paintbrush,
  Plug,
  Sparkles,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Icon per category slug (matches seed data). */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  electrical: Zap,
  plumbing: Droplet,
  cleaning: Sparkles,
  appliance: Plug,
  painting: Paintbrush,
  carpentry: Hammer,
  wrench: Wrench,
};

/** Tile hue per category slug — distinctive but harmonious. */
const CATEGORY_HUES: Record<string, number> = {
  electrical: 45,
  plumbing: 205,
  cleaning: 160,
  appliance: 230,
  painting: 340,
  carpentry: 25,
};

export function categoryIcon(slug: string): LucideIcon {
  return CATEGORY_ICONS[slug] ?? Wrench;
}

export function categoryHue(slug: string): number {
  return CATEGORY_HUES[slug] ?? 150;
}
