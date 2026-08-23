"use client";
import { Controller, type Control, type UseFormRegister } from "react-hook-form";
import { z } from "zod";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Account } from "@/types/domain";

// Risk limits + fee model for the account create/update forms. Both `NewAccount.risk` and `.fee`
// are optional on the wire and both are tagged unions, so the form keeps a flat set of string
// fields and folds them into the right variant on submit — which keeps react-hook-form out of the
// business of validating a discriminated union whose shape changes as you pick.
//
// Numbers are strings in the form on purpose: a number input bound to a number re-formats what you
// are halfway through typing ("0." collapses to 0), and an empty box has to mean "unset", not 0.

type RiskType = "none" | "spot" | "linear_futures" | "inverse_futures";
type FeeType = "rate" | "dnse_derivatives";

const RISK_LABEL: Record<RiskType, string> = {
  none: "None (no limits)",
  spot: "Spot — order value",
  linear_futures: "Linear futures — leverage & notional",
  inverse_futures: "Inverse futures — leverage & notional",
};

const FEE_LABEL: Record<FeeType, string> = {
  rate: "Rate — maker/taker %",
  dnse_derivatives: "DNSE derivatives — VND per contract",
};

const amount = z.string().trim();

export const riskFeeSchema = {
  riskType: z.enum(["none", "spot", "linear_futures", "inverse_futures"]),
  riskMinOrderValue: amount,
  riskMaxOrderValue: amount,
  riskMaxLeverage: amount,
  riskMaxNotional: amount,
  feeType: z.enum(["rate", "dnse_derivatives"]),
  feeMakerPct: amount,
  feeTakerPct: amount,
  feeClearing: amount,
  feeExchange: amount,
  feeVenue: amount,
  feeMaintenanceMargin: amount,
};

export type RiskFeeValues = z.infer<z.ZodObject<typeof riskFeeSchema>>;

/**
 * Trims the float noise out of a computed decimal.
 *
 * A rate of 0.00018 read back as `0.00018 * 100` is `0.018000000000000002`, which is exactly what
 * the Maker rate box showed. 12 significant digits is far more than any rate carries and lands on
 * the number that was actually meant.
 */
const clean = (n: number) => Number(n.toPrecision(12));

const numText = (n: number | undefined) => (n === undefined ? "" : String(clean(n)));
/** Rates are fractions on the wire and percents in the form. */
const pctText = (rate: number | undefined) => (rate === undefined ? "" : String(clean(rate * 100)));

const toNum = (s: string): number | undefined => {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};

export const RISK_FEE_DEFAULTS: RiskFeeValues = {
  riskType: "none",
  riskMinOrderValue: "",
  riskMaxOrderValue: "",
  riskMaxLeverage: "",
  riskMaxNotional: "",
  feeType: "rate",
  feeMakerPct: "",
  feeTakerPct: "",
  feeClearing: "",
  feeExchange: "",
  feeVenue: "",
  feeMaintenanceMargin: "",
};

/** Spreads an existing account's risk/fee back into form fields. */
export function riskFeeValuesOf(account: Account): RiskFeeValues {
  const risk = account.risk;
  const fee = account.fee;
  return {
    ...RISK_FEE_DEFAULTS,
    riskType: risk.type,
    ...(risk.type === "spot"
      ? { riskMinOrderValue: numText(risk.min_order_value), riskMaxOrderValue: numText(risk.max_order_value) }
      : {}),
    ...(risk.type === "linear_futures" || risk.type === "inverse_futures"
      ? { riskMaxLeverage: numText(risk.max_leverage), riskMaxNotional: numText(risk.max_notional) }
      : {}),
    feeType: fee.type,
    ...(fee.type === "rate" ? { feeMakerPct: pctText(fee.maker_rate), feeTakerPct: pctText(fee.taker_rate) } : {}),
    ...(fee.type === "dnse_derivatives"
      ? {
          feeClearing: numText(fee.clearing_fee),
          feeExchange: numText(fee.exchange_fee),
          feeVenue: numText(fee.venue_fee),
          feeMaintenanceMargin: numText(fee.maintenance_margin),
        }
      : {}),
  };
}

/** `undefined` when the variant's numbers are not all filled in — the field is optional on the wire. */
export function toRiskConfig(v: RiskFeeValues): Account["risk"] | undefined {
  if (v.riskType === "none") return { type: "none" };
  if (v.riskType === "spot") {
    const min = toNum(v.riskMinOrderValue);
    const max = toNum(v.riskMaxOrderValue);
    return min === undefined || max === undefined
      ? undefined
      : { type: "spot", min_order_value: min, max_order_value: max };
  }
  const leverage = toNum(v.riskMaxLeverage);
  const notional = toNum(v.riskMaxNotional);
  return leverage === undefined || notional === undefined
    ? undefined
    : { type: v.riskType, max_leverage: leverage, max_notional: notional };
}

export function toFeeConfig(v: RiskFeeValues): Account["fee"] | undefined {
  if (v.feeType === "rate") {
    const maker = toNum(v.feeMakerPct);
    const taker = toNum(v.feeTakerPct);
    return maker === undefined || taker === undefined
      ? undefined
      : { type: "rate", maker_rate: clean(maker / 100), taker_rate: clean(taker / 100) };
  }
  const clearing = toNum(v.feeClearing);
  const exchange = toNum(v.feeExchange);
  const venue = toNum(v.feeVenue);
  const margin = toNum(v.feeMaintenanceMargin);
  return clearing === undefined || exchange === undefined || venue === undefined || margin === undefined
    ? undefined
    : {
        type: "dnse_derivatives",
        clearing_fee: clearing,
        exchange_fee: exchange,
        venue_fee: venue,
        maintenance_margin: margin,
      };
}

function NumberField({
  id,
  label,
  placeholder,
  fieldClass,
  registration,
}: {
  id: string;
  label: string;
  placeholder?: string;
  fieldClass: string;
  registration: ReturnType<UseFormRegister<Record<string, unknown>>>;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <Label htmlFor={id} className="font-normal text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        inputMode="decimal"
        placeholder={placeholder}
        autoComplete="off"
        className={fieldClass}
        {...registration}
      />
    </div>
  );
}

/**
 * `control` / `register` come from the host form, so create and edit share one definition of these
 * fields — they submit to the same two schemas and would drift apart the moment they were written
 * twice. The host's value type extends `RiskFeeValues`; RHF's generics cannot express that from
 * here without dragging the whole parent shape through, and every field name below is checked
 * against `riskFeeSchema`.
 */
export function RiskFeeFields({
  idPrefix,
  fieldClass,
  control,
  register,
  riskType,
  feeType,
}: {
  idPrefix: string;
  fieldClass: string;
  control: Control<RiskFeeValues>;
  register: UseFormRegister<Record<string, unknown>>;
  riskType: RiskType;
  feeType: FeeType;
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label className="font-normal text-muted-foreground">Risk limits</Label>
        <Controller
          control={control}
          name="riskType"
          render={({ field }) => (
            <Select value={field.value ?? "none"} onValueChange={field.onChange}>
              <SelectTrigger id={`${idPrefix}-risk-type`} className={fieldClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RISK_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {riskType === "spot" && (
        <div className="flex gap-3">
          <NumberField
            id={`${idPrefix}-risk-min`}
            label="Min order value"
            fieldClass={fieldClass}
            registration={register("riskMinOrderValue")}
          />
          <NumberField
            id={`${idPrefix}-risk-max`}
            label="Max order value"
            fieldClass={fieldClass}
            registration={register("riskMaxOrderValue")}
          />
        </div>
      )}

      {(riskType === "linear_futures" || riskType === "inverse_futures") && (
        <div className="flex gap-3">
          <NumberField
            id={`${idPrefix}-risk-leverage`}
            label="Max leverage"
            fieldClass={fieldClass}
            registration={register("riskMaxLeverage")}
          />
          <NumberField
            id={`${idPrefix}-risk-notional`}
            label="Max notional"
            fieldClass={fieldClass}
            registration={register("riskMaxNotional")}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label className="font-normal text-muted-foreground">Fee model</Label>
        <Controller
          control={control}
          name="feeType"
          render={({ field }) => (
            <Select value={field.value ?? "rate"} onValueChange={field.onChange}>
              <SelectTrigger id={`${idPrefix}-fee-type`} className={fieldClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FEE_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {feeType === "rate" ? (
        <div className="flex gap-3">
          <NumberField
            id={`${idPrefix}-fee-maker`}
            label="Maker rate (%)"
            placeholder="0.018"
            fieldClass={fieldClass}
            registration={register("feeMakerPct")}
          />
          <NumberField
            id={`${idPrefix}-fee-taker`}
            label="Taker rate (%)"
            placeholder="0.045"
            fieldClass={fieldClass}
            registration={register("feeTakerPct")}
          />
        </div>
      ) : (
        <>
          <div className="flex gap-3">
            <NumberField
              id={`${idPrefix}-fee-venue`}
              label="Venue fee (VND/contract)"
              fieldClass={fieldClass}
              registration={register("feeVenue")}
            />
            <NumberField
              id={`${idPrefix}-fee-exchange`}
              label="Exchange fee (VND/contract)"
              fieldClass={fieldClass}
              registration={register("feeExchange")}
            />
          </div>
          <div className="flex gap-3">
            <NumberField
              id={`${idPrefix}-fee-clearing`}
              label="Clearing fee (VND/contract)"
              fieldClass={fieldClass}
              registration={register("feeClearing")}
            />
            <NumberField
              id={`${idPrefix}-fee-margin`}
              label="Maintenance margin"
              placeholder="0.1848"
              fieldClass={fieldClass}
              registration={register("feeMaintenanceMargin")}
            />
          </div>
        </>
      )}
    </>
  );
}
