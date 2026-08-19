import { AddCircle, ServerMinimalistic, Translation, DiagramUp, DangerCircle, ClipboardList } from "@solar-icons/react";
import type { IconProps } from "@solar-icons/react";
import { Receipt2 } from "@/components/icons/receipt-2";
import { EmptyWalletTime } from "@/components/icons/empty-wallet-time";
import type { Mode } from "@/store/mode-store";

type IconComponent = React.ForwardRefExoticComponent<Omit<IconProps, "ref"> & React.RefAttributes<SVGSVGElement>>;

// `modes` lists the lab modes an item belongs to; omit to show it in both (the default today).
// This is the hook for future HFT-only / MFT-only pages — set e.g. `modes: ["hft"]`.
// `requiresAccess` hides the item for a None-scoped caller (RBAC-gated resource family);
// `adminOnly` hides it for non-admins (for future admin-only surfaces). See lib/rbac.ts.
// `children` are nested sub-routes rendered indented under the parent (Figma 13964:56847); they
// carry no icon and inherit the parent's mode/RBAC gating.
export type NavChild = { label: string; href: string };
export type NavItem = { label: string; href: string; icon: IconComponent; modes?: Mode[]; requiresAccess?: boolean; adminOnly?: boolean; children?: NavChild[] };
export type NavGroup = { heading?: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    heading: "Quant Lab",
    items: [
      { label: "Create strategy", href: "/create-strategy", icon: AddCircle, requiresAccess: true },
      { label: "Backtesting", href: "/strategies", icon: ServerMinimalistic, requiresAccess: true },
      // Admin console for the promotion ladder — every strategy, its owner/version/stage, and the
      // promote + launch actions. Admin-only: /api/users and /api/promotions both 403 otherwise.
      { label: "Strategy List", href: "/strategy-list", icon: ClipboardList, adminOnly: true },
      { label: "Paper Trading", href: "/paper-trading", icon: Receipt2, requiresAccess: true },
    ],
  },
  {
    heading: "Live Operations",
    items: [
      { label: "Venue", href: "/venues", icon: EmptyWalletTime },
      { label: "Live account", href: "/accounts", icon: Translation, requiresAccess: true },
      // Thresholds, the audit log and every risk mutation are admin-only (403 otherwise); the
      // live-status half follows the same visibility rule as the accounts list.
      { label: "Risk management", href: "/risk-management", icon: DangerCircle, adminOnly: true },
      {
        label: "Live trading",
        href: "/live-trading",
        icon: DiagramUp,
        requiresAccess: true,
        children: [
          { label: "Alpha pool", href: "/live-trading/alpha-pool" },
          { label: "Live trade", href: "/live-trading/live-trade" },
        ],
      },
    ],
  },
];
