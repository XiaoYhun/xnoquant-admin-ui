import type { SVGProps } from "react";

// Bare x-mark close icon. The Figma dialogs use a plain "x-mark" and Solar only ships a
// Close inside a circle/square, so this stroke icon is hand-authored (per the icon rule).
export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
