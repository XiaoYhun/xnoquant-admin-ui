import { Logo } from "@/components/layout/logo";

// Ambient colour field behind the auth card: a few oversized, heavily blurred orbs in the brand
// palette, so the screen reads as a lit space instead of a card floating in a void (the shape
// app.uniswap.org uses). Pure CSS — no images, no JS — and both `.auth-orb` (the slow drift) and
// `.auth-in` (the entrance) hold still for anyone who asked for reduced motion.
//
// Each orb gets its own travel vector via `--orb-dx/dy/ds`, so they cross rather than sliding as
// one sheet — that, plus mismatched durations, is what keeps the field from looking frozen. Only
// transform is animated, so this stays off the paint path.
type OrbStyle = React.CSSProperties & Record<`--orb-${string}`, string>;

const ORBS = [
  {
    className: "-top-24 -left-24 size-[420px] bg-primary/25 blur-[130px]",
    style: { "--orb-dx": "60px", "--orb-dy": "44px", "--orb-ds": "1.12", animationDuration: "14s" },
  },
  {
    className: "top-[8%] -right-20 size-[380px] bg-[#7b61ff]/25 blur-[130px]",
    style: {
      "--orb-dx": "-72px",
      "--orb-dy": "56px",
      "--orb-ds": "1.06",
      animationDuration: "18s",
      animationDelay: "-4s",
    },
  },
  {
    className: "bottom-[-15%] left-[22%] size-[460px] bg-accent/20 blur-[140px]",
    style: {
      "--orb-dx": "80px",
      "--orb-dy": "-52px",
      "--orb-ds": "1.1",
      animationDuration: "20s",
      animationDelay: "-9s",
    },
  },
  {
    className: "right-[14%] bottom-[6%] size-[300px] bg-[#3e7bfa]/20 blur-[120px]",
    style: {
      "--orb-dx": "-56px",
      "--orb-dy": "-70px",
      "--orb-ds": "1.15",
      animationDuration: "16s",
      animationDelay: "-2s",
    },
  },
] satisfies { className: string; style: OrbStyle }[];

function AmbientOrbs() {
  return (
    <div
      aria-hidden
      className="auth-in pointer-events-none absolute inset-0 overflow-hidden"
      style={{ animationDuration: "1.4s" }}
    >
      {ORBS.map((orb) => (
        <div key={orb.className} className={`auth-orb absolute rounded-full ${orb.className}`} style={orb.style} />
      ))}
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-4">
      <AmbientOrbs />
      <div className="relative flex flex-col items-center gap-7">
        {/* Head of the entrance stagger — the page's own pieces follow on their own delays. */}
        <div className="auth-in">
          <Logo />
        </div>
        {children}
      </div>
    </div>
  );
}
