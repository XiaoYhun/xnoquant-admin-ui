import { redirect } from "next/navigation";

// Live trading is now split into two sub-routes (Figma 13964:56847); Alpha pool is the entry
// point — strategies land there on promotion before anyone starts them.
export default function Page() {
  redirect("/live-trading/alpha-pool");
}
