"use client";
import { useState } from "react";
import { Letter } from "@solar-icons/react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CloseIcon } from "@/components/icons/close";
import { Input } from "@/components/ui/input";
import { resourceErrorMessage } from "@/lib/api-client";
import { useRefreshDnseToken, useSendDnseOtp } from "@/hooks/api/use-accounts";
import type { Account } from "@/types/domain";

// Refresh a DNSE account's 8-hour trading token — Figma node 14883:147190.
//
// Two ways in, per the API's `otp_type`: a code from DNSE's Smart OTP app, or one emailed to the
// account owner (`POST .../dnse/send-otp` triggers that mail). Redeeming writes the token to
// Redis, so strategies already running on the account pick it up without restarting.
//
// The design drops the Smart-OTP/Email-OTP selector this dialog used to have and leaves one code
// field, so `otp_type` is inferred: pressing "Send OTP to Email" switches the submission to
// `email_otp`, otherwise it stays `smart_otp`. That matches the copy in the box ("Email OTP: send
// first, then paste the code") and is the only signal the design offers. If a user is meant to be
// able to send the mail and still redeem a Smart OTP code, the selector has to come back.

const GRAD_GREEN = "bg-[linear-gradient(177deg,#cff8ea_0%,#67e1c1_100%)] bg-clip-text text-transparent";

export function RefreshDnseTokenDialog({
  account,
  open,
  onOpenChange,
}: {
  account: Account | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [passcode, setPasscode] = useState("");
  const [emailed, setEmailed] = useState(false);

  const refresh = useRefreshDnseToken();
  const sendOtp = useSendDnseOtp();

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPasscode("");
      setEmailed(false);
      refresh.reset();
      sendOtp.reset();
    }
    onOpenChange(next);
  };

  const handleSubmit = () => {
    // The server rejects an empty passcode with a 400 — don't spend the round-trip.
    if (!account || !passcode.trim() || refresh.isPending) return;
    refresh.mutate(
      { id: account.id, otpType: emailed ? "email_otp" : "smart_otp", passcode: passcode.trim() },
      { onSuccess: () => handleOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[480px] max-w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-[20px] border-border bg-background p-0"
      >
        <DialogHeader className="flex-row items-center bg-surface px-4 py-2.5">
          <DialogTitle className="text-lg leading-6 font-semibold text-white">
            Refresh DNSE trading token
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 p-4">
          <DialogDescription className="text-sm leading-5 text-[#9db2ce]">
            Redeems a fresh OTP for &ldquo;{account?.name}&rdquo; and hands the resulting 8-hour trading token
            straight to any strategy already running on this account — no restart required.
          </DialogDescription>

          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-2">
            <div className="flex flex-col">
              <span className={`text-sm leading-5 font-semibold ${GRAD_GREEN}`}>OTP</span>
              <p className="text-xs leading-[18px] text-[#9db2ce]">
                Smart OTP: enter your authenticator code directly.
              </p>
              <p className="text-xs leading-[18px] text-[#9db2ce]">Email OTP: send first, then paste the code.</p>
            </div>

            <div className="flex items-start gap-3">
              <button
                type="button"
                disabled={!account || sendOtp.isPending}
                onClick={() => {
                  if (!account) return;
                  sendOtp.mutate(account.id, { onSuccess: () => setEmailed(true) });
                }}
                className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 self-stretch rounded-[32px] border border-border bg-black px-3 py-2 text-xs leading-[18px] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Letter weight="Outline" className="size-[18px]" />
                {sendOtp.isPending ? "Sending…" : "Send OTP to Email"}
              </button>
              <Input
                autoFocus
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                className="h-auto min-w-px flex-1 rounded-[20px] border-border bg-background px-3 py-2 text-sm leading-5 text-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] placeholder:text-[#9db2ce]"
              />
            </div>

            {emailed && !sendOtp.isError && (
              <span className="text-xs leading-[18px] text-primary">Sent to the account owner.</span>
            )}
            {sendOtp.isError && (
              <span className="text-xs leading-[18px] text-destructive">
                {resourceErrorMessage(sendOtp.error, "this account")}
              </span>
            )}
          </div>

          {refresh.isError && (
            <p className="text-xs leading-[18px] text-destructive">
              {resourceErrorMessage(refresh.error, "this account")}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="flex-1 cursor-pointer rounded-[32px] border border-border bg-black px-3 py-2 text-xs leading-[18px] text-white transition-opacity hover:opacity-90"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!passcode.trim() || refresh.isPending}
            className="flex-1 cursor-pointer rounded-[32px] bg-[linear-gradient(171deg,#cff8ea_0%,#67e1c1_100%)] px-3 py-2 text-xs leading-[18px] text-[#0d0d0d] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refresh.isPending ? "Refreshing…" : "Refresh token"}
          </button>
        </div>

        <DialogClose
          aria-label="Close"
          className="absolute top-[11px] right-[11px] cursor-pointer text-muted-foreground opacity-70 transition-opacity hover:opacity-100"
        >
          <CloseIcon className="size-6" />
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
