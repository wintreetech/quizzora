import type { CSSProperties } from "react";
import { Icon } from "../lib";
const covers: Record<
  string,
  { name: string; index: string; color: string; ink: string; icon: any }
> = {
  space: {
    name: "Beyond\nthe ordinary.",
    index: "01",
    color: "#dae4ff",
    ink: "#2045cf",
    icon: "Atom",
  },
  cinema: {
    name: "Scene.\nSet. Match.",
    index: "02",
    color: "#ffe2d7",
    ink: "#a63f24",
    icon: "Clapperboard",
  },
  tech: {
    name: "Think\nforward.",
    index: "03",
    color: "#1a263b",
    ink: "#d9f471",
    icon: "Monitor",
  },
  world: {
    name: "A world\nto discover.",
    index: "04",
    color: "#dce9e6",
    ink: "#255b54",
    icon: "Globe",
  },
  music: {
    name: "Know\nyour rhythm.",
    index: "05",
    color: "#e9e2ff",
    ink: "#4a3e93",
    icon: "Music",
  },
  sport: {
    name: "More than\na spectator.",
    index: "06",
    color: "#ebefcf",
    ink: "#4a531b",
    icon: "Dribbble",
  },
  history: {
    name: "Past.\nPresent. You.",
    index: "07",
    color: "#f4e5d3",
    ink: "#785333",
    icon: "Landmark",
  },
  business: {
    name: "Ahead of\nthe curve.",
    index: "08",
    color: "#d9e8f6",
    ink: "#244966",
    icon: "Briefcase",
  },
};
export function EditorialCover({ kind = "space" }: { kind?: string }) {
  const c = covers[kind] || covers.space;
  return (
    <div
      className={`editorial-cover cover-${kind}`}
      style={{ "--cover": c.color, "--cover-ink": c.ink } as CSSProperties}
      aria-hidden="true"
    >
      <span className="editorial-index">Q / {c.index}</span>
      <strong>{c.name}</strong>
      <div className="editorial-symbol">
        <Icon name={c.icon} size={74} strokeWidth={1} />
      </div>
      <span className="editorial-caption">
        THE KNOWLEDGE SERIES <i>↗</i>
      </span>
    </div>
  );
}
export function ArenaArtwork() {
  return (
    <div className="arena-art" aria-hidden="true">
      <div className="arena-grid" />
      <div className="arena-orbit orbit-a" />
      <div className="arena-orbit orbit-b" />
      <div className="arena-spark">
        <svg viewBox="0 0 240 240" fill="none">
          <path
            d="M120 0 139 76 204 36 164 101 240 120 164 139 204 204 139 164 120 240 101 164 36 204 76 139 0 120 76 101 36 36 101 76Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <span className="arena-tag tag-one">
        <Icon name="Zap" size={18} /> BUILT FOR YOUR BRIGHT SIDE
      </span>
      <span className="arena-tag tag-two">
        THINK. PLAY. REPEAT. <Icon name="ArrowUpRight" size={20} />
      </span>
      <span className="arena-coordinate">18+ / KNOWLEDGE IS THE ADVANTAGE</span>
    </div>
  );
}
