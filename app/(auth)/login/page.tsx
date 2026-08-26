"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CloseCircle, Eye, EyeClosed } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.string().min(1, "Please enter your email").email("Invalid email format"),
  password: z.string().min(1, "Please enter your password"),
});
type FormValues = z.infer<typeof schema>;

const FIELDS = ["email", "password"] as const;

// Field chrome — one definition so the two inputs cannot drift apart. Taller and rounder than the
// app default Input: this is the only thing on the screen, so it gets room.
const FIELD =
  "h-12 rounded-2xl border-transparent bg-background/60 px-4 text-sm shadow-none focus-visible:border-primary/50";

export default function LoginPage() {
  const router = useRouter();
  const { login, logout, status, user, error: sessionError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autofilled, setAutofilled] = useState({ email: false, password: false });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  // Chrome fills saved credentials without firing React onChange, AND hides what it filled from
  // scripts until the page has seen a user gesture — so react-hook-form starts out convinced both
  // fields are empty, and would reject a form the user can plainly see filled in. The
  // `:-webkit-autofill` state IS readable, so track that per field to keep the button honest, and
  // copy the real values across on the first gesture, which is when they become readable.
  const gestured = useRef(false);
  const syncAutofill = useCallback(() => {
    const filled = { email: false, password: false };
    for (const name of FIELDS) {
      const el = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      if (!el) continue;
      if (el.value) form.setValue(name, el.value);
      // Only meaningful before the first gesture, while the value still reads as "". After that the
      // value itself is the truth — and `:-webkit-autofill` outlives a field being emptied.
      filled[name] = !gestured.current && el.matches(":-webkit-autofill");
    }
    setAutofilled(filled);
  }, [form]);

  useEffect(() => {
    const t = setTimeout(syncAutofill, 200); // Chrome fills a beat after mount
    // `pointerdown` is the gesture that unmasks the values; `input` re-reads after every edit.
    const onGesture = () => {
      gestured.current = true;
      syncAutofill();
    };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("input", onGesture);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("input", onGesture);
    };
  }, [syncAutofill]);

  // Already have a valid, verified session → skip the login screen.
  useEffect(() => {
    if (status === "authenticated" && user?.email_verified) {
      router.replace("/");
    }
  }, [status, user, router]);

  const submit = form.handleSubmit(async (values) => {
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

  // Sync before validating: this click is itself the gesture that unmasks an autofilled password.
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    syncAutofill();
    void submit();
  };

  const isUnverified = status === "authenticated" && !!user && !user.email_verified;
  const inlineError = submitError ?? (isUnverified ? null : sessionError);

  // The submit button names the next thing to do rather than sitting there greyed out and mute —
  // the pattern app.uniswap.org uses for its "Select token" / "Enter an amount" CTA. It stays
  // clickable so a mistaken click still runs validation and points at the offending field.
  const [email, password] = useWatch({ control: form.control, name: FIELDS });
  const hasEmail = email.trim().length > 0 || autofilled.email;
  const hasPassword = password.length > 0 || autofilled.password;
  const ctaLabel = isSubmitting
    ? "Signing in…"
    : !hasEmail
      ? "Enter your email"
      : !hasPassword
        ? "Enter your password"
        : "Sign in";

  return (
    <div className="flex w-full max-w-[420px] flex-col items-center gap-6">
      <h1
        style={{ animationDelay: "90ms" }}
        className="auth-in text-center text-[32px] leading-tight font-semibold tracking-[-0.02em] text-foreground sm:text-[40px]"
      >
        Welcome back.
      </h1>

      <div
        style={{ animationDelay: "180ms" }}
        className="auth-in w-full rounded-3xl border border-white/5 bg-surface/70 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl"
      >
        <Form {...form}>
          <form onSubmit={onSubmit} className="flex flex-col gap-4" autoComplete="off">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      autoFocus
                      className={FIELD}
                      {...field}
                    />
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
                  <FormLabel className="text-xs text-muted-foreground">Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Your password"
                        autoComplete="current-password"
                        className={cn(FIELD, "pr-12")}
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeClosed size={18} weight="Outline" /> : <Eye size={18} weight="Outline" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isUnverified && (
              <div className="flex flex-col gap-1 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm">
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
            {inlineError && (
              <p className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <CloseCircle size={16} weight="Outline" className="mt-0.5 shrink-0" />
                {inlineError}
              </p>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "mt-1 h-12 w-full rounded-2xl text-sm font-semibold",
                !(hasEmail && hasPassword) && "bg-primary/15 text-primary hover:bg-primary/25",
              )}
            >
              {ctaLabel}
            </Button>
          </form>
        </Form>
      </div>

      <p
        style={{ animationDelay: "270ms" }}
        className="auth-in max-w-[340px] text-center text-sm leading-relaxed text-muted-foreground"
      >
        XNOQuant accounts are created by your workspace admin — ask them if you do not have one yet.
      </p>
    </div>
  );
}
