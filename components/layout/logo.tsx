export function Logo() {
  return (
    <div className="flex items-center gap-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-symbol.svg" alt="XNOQuant" className="h-7 w-auto shrink-0" />
      <span className="text-[22px] font-bold leading-none tracking-[-0.44px] text-white">
        XNOQuant
      </span>
    </div>
  );
}
