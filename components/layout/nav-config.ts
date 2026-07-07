import { PlusCircle, List, FlaskConical, Building2, Radio, LineChart, type LucideIcon } from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon };
export type NavGroup = { heading?: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  { items: [{ label: "Create strategy", href: "/create-strategy", icon: PlusCircle }] },
  {
    heading: "Quant Lab",
    items: [
      { label: "Strategy List", href: "/strategies", icon: List },
      { label: "Paper Trading", href: "/paper-trading", icon: FlaskConical },
    ],
  },
  {
    heading: "Live Operations",
    items: [
      { label: "Venue", href: "/venues", icon: Building2 },
      { label: "Live account", href: "/accounts", icon: Radio },
      { label: "Live trading", href: "/live-trading", icon: LineChart },
    ],
  },
];
