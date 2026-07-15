import { AddCircle, ServerMinimalistic, Translation, DiagramUp } from "@solar-icons/react";
import type { IconProps } from "@solar-icons/react";
import { Receipt2 } from "@/components/icons/receipt-2";
import { EmptyWalletTime } from "@/components/icons/empty-wallet-time";
import type { Mode } from "@/store/mode-store";

type IconComponent = React.ForwardRefExoticComponent<Omit<IconProps, "ref"> & React.RefAttributes<SVGSVGElement>>;

// `modes` lists the lab modes an item belongs to; omit to show it in both (the default today).
// This is the hook for future HFT-only / MFT-only pages — set e.g. `modes: ["hft"]`.
export type NavItem = { label: string; href: string; icon: IconComponent; modes?: Mode[] };
export type NavGroup = { heading?: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    heading: "Quant Lab",
    items: [
      { label: "Create strategy", href: "/create-strategy", icon: AddCircle },
      { label: "Strategy List", href: "/strategies", icon: ServerMinimalistic },
      { label: "Paper Trading", href: "/paper-trading", icon: Receipt2 },
    ],
  },
  {
    heading: "Live Operations",
    items: [
      { label: "Venue", href: "/venues", icon: EmptyWalletTime },
      { label: "Live account", href: "/accounts", icon: Translation },
      { label: "Live trading", href: "/live-trading", icon: DiagramUp },
    ],
  },
];
