"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeClosed } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/hooks/use-auth";

const schema = z.object({
  email: z.string().min(1, "Please enter your email").email("Invalid email format"),
  password: z.string().min(1, "Please enter your password"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, logout, status, user, error: sessionError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  // Already have a valid, verified session → skip the login screen.
  useEffect(() => {
    if (status === "authenticated" && user?.email_verified) {
      router.replace("/");
    }
  }, [status, user, router]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await login(values.email, values.password);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  });

  const isUnverified = status === "authenticated" && !!user && !user.email_verified;
  const inlineError = submitError ?? (isUnverified ? null : sessionError);

  return (
    <div className="w-full max-w-[400px] rounded-lg border border-border bg-surface p-8 shadow-lg">
      <div className="mb-6 flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Login</h1>
        <p className="text-sm text-muted-foreground">Sign in to the XNOQuant admin console</p>
      </div>

      <Form {...form}>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" autoComplete="off">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="you@example.com" autoComplete="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      autoComplete="current-password"
                      className="pr-10"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 flex w-9 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeClosed size={18} weight="Outline" />
                      ) : (
                        <Eye size={18} weight="Outline" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {isUnverified && (
            <div className="flex flex-col gap-1 text-sm">
              <p className="text-destructive">
                This account&apos;s email is not verified. Please verify your email, then sign in again.
              </p>
              <button
                type="button"
                onClick={() => void logout()}
                className="cursor-pointer text-left text-muted-foreground underline hover:text-foreground"
              >
                Sign out and use a different account
              </button>
            </div>
          )}
          {inlineError && <p className="text-sm text-destructive">{inlineError}</p>}

          <Button type="submit" className="mt-2 h-10 w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
