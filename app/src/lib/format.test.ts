import { describe, expect, it } from "vitest";
import { formatUsdc, humanizeError, shortAddress } from "./format";

describe("format", () => {
  it("formats 6-decimal USDC values", () => {
    expect(formatUsdc(10000n)).toBe("0.01");
    expect(formatUsdc(1_000_000n)).toBe("1");
    expect(formatUsdc(1n)).toBe("0.000001");
    expect(formatUsdc(0n)).toBe("0");
  });

  it("shortens addresses", () => {
    expect(shortAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe(
      "0x1234...5678"
    );
  });

  it("turns wallet rejection into a readable message", () => {
    expect(humanizeError(new Error("User rejected the request."))).toBe(
      "Wallet request was rejected."
    );
  });

  it("maps studio contract errors", () => {
    expect(humanizeError(new Error("AlreadyUsed"))).toContain("already paid");
    expect(humanizeError(new Error("VendorIsContract"))).toContain(
      "RequisitionBook contract"
    );
    expect(humanizeError(new Error("BatchTooLarge"))).toContain("at most 50");
  });

  it("turns allowance errors into a readable message", () => {
    expect(humanizeError(new Error("ERC20InsufficientAllowance"))).toBe(
      "USDC allowance is too low. Approve the exact total and retry."
    );
  });
});
