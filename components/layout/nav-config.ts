import { AddCircle, ClipboardList, TestTube, Buildings2, Radio, ChartSquare } from "@solar-icons/react";
import type { IconProps } from "@solar-icons/react";

type IconComponent = React.ForwardRefExoticComponent<Omit<IconProps, "ref"> & React.RefAttributes<SVGSVGElement>>;

export type NavItem = { label: string; href: string; icon: IconComponent };
export type NavGroup = { heading?: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  { items: [{ label: "Create strategy", href: "/create-strategy", icon: AddCircle }] },
  {
    heading: "Quant Lab",
    items: [
      { label: "Strategy List", href: "/strategies", icon: ClipboardList },
      { label: "Paper Trading", href: "/paper-trading", icon: TestTube },
    ],
  },
  {
    heading: "Live Operations",
    items: [
      { label: "Venue", href: "/venues", icon: Buildings2 },
      { label: "Live account", href: "/accounts", icon: Radio },
      { label: "Live trading", href: "/live-trading", icon: ChartSquare },
    ],
  },
];
