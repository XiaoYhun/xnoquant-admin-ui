import { Header } from "@/components/layout/header";
export default function Page() {
  return (
    <>
      <Header title="Live trading" />
      <main className="flex-1 overflow-auto p-6">
        <p className="text-muted-foreground">Live trading — coming soon.</p>
      </main>
    </>
  );
}
