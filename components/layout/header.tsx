"use client";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Header({ title }: { title: string }) {
  const { user } = useAuth();
  return (
    <header className="flex h-16 items-center justify-between border-b border-border px-6">
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="flex items-center gap-2">
        <div className="text-right text-sm">
          <p className="font-medium">{user?.name}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <Avatar className="size-8"><AvatarFallback>A</AvatarFallback></Avatar>
      </div>
    </header>
  );
}
