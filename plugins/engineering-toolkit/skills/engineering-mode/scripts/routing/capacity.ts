import type { ReceiptStatus } from "../runner/types.ts";
import type { DropoutClass } from "./route.ts";

const CAPACITY =
  /usage limit|quota|\b429\b|rate limit|resource exhausted|too many requests|billing limit/i;
const AUTH =
  /not logged in|unauthenticated|authentication|sign in|login required/i;
const MODEL =
  /model.{0,40}(not found|unknown|unavailable|unsupported|not supported|invalid)|invalid.{0,20}model/i;

export function classifyProcessFailure(input: {
  readonly exitCode: number | null;
  readonly combinedText: string;
}): Exclude<ReceiptStatus, "complete" | "cancelled" | "timed-out"> {
  void input.exitCode;
  const text = input.combinedText;
  if (CAPACITY.test(text)) return "capacity-exhausted";
  if (AUTH.test(text)) return "unauthenticated";
  if (MODEL.test(text)) return "unavailable-model";
  return "child-failed";
}

export function classifyNativeCapacity(input: {
  readonly message: string;
  readonly evidence: string;
}): "complete" | DropoutClass {
  const status = classifyProcessFailure({
    exitCode: null,
    combinedText: `${input.message}\n${input.evidence}`,
  });
  switch (status) {
    case "capacity-exhausted":
      return "capacity";
    case "unauthenticated":
      return "unauthenticated";
    case "unavailable-model":
      return "unavailable-model";
    case "unavailable-cli":
      return "unavailable-cli";
    case "child-failed":
      return "child-failed";
    case "malformed-output":
      return "malformed-output";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
