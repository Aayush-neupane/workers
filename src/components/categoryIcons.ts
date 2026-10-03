import {
  BrickWall,
  Bug,
  Cog,
  Hammer,
  Paintbrush,
  Refrigerator,
  Snowflake,
  Sparkles,
  Toolbox,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  wrench: Wrench,
  zap: Zap,
  hammer: Hammer,
  paintbrush: Paintbrush,
  sparkles: Sparkles,
  refrigerator: Refrigerator,
  snowflake: Snowflake,
  wifi: Wifi,
  cog: Cog,
  bug: Bug,
  toolbox: Toolbox,
  brick: BrickWall,
};

/** Distinctive but harmonious tile hue per category. */
export const CATEGORY_HUES: Record<string, number> = {
  plumbing: 205,
  electrical: 45,
  carpentry: 25,
  painting: 340,
  cleaning: 160,
  appliance: 230,
  ac: 190,
  network: 265,
  mechanical: 10,
  pest: 90,
  maintenance: 150,
  masonry: 35,
};
