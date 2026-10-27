import { describe, expect, it } from "vitest";
import { keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  domainFor,
  messageFor,
  purposeHash,
  requestIdFor,
  requisitionTypes,
  validateBundleShape,
  verifyItem,
  type Bundle,
  type RequisitionItem
} from "./requisition";

const AGENT_PK =
  "0x00000000000000000000000000000000000000000000000000000000000A11CE" as const;
const account = privateKeyToAccount(AGENT_PK);
const buyer = "0x000000000000000000000000000000000000bEEF" as const;
const vendor = "0x000000000000000000000000000000000000cafE" as const;
const contract = "0x0000000000000000000000000000000000001234" as const;
const purpose = "api credits";
const nonce = keccak256(toBytes("nonce-1"));

function baseItem(overrides: Partial<RequisitionItem["request"]> = {}): RequisitionItem {
  return {
    request: {
      agent: account.address,
      buyer,
      vendor,
      amount: "10000",
      purposeHash: purposeHash(purpose),
      expiresAt: "1800003600",
      nonce,
      ...overrides
    },
    signature: "0x",
    purpose
  };
}

function baseBundle(item: RequisitionItem = baseItem()): Bundle {
  return {
    v: 1,
    chainId: 5042,
    contract,
    createdAt: "2026-10-26T12:00:00Z",
    agentLabel: "test-agent",
    requests: [item]
  };
}

describe("requisition", () => {
  it("matches the contract EIP-712 fixture", () => {
    const bundle = baseBundle();
    expect(requestIdFor(bundle.requests[0], bundle)).toBe(
      "0x8c4082909009cdb1910480a2caa644a729e274b62d8e0aa335a095204d363125"
    );
  });

  it("verifies a real agent signature", async () => {
    const bundle = baseBundle();
    const signature = await account.signTypedData({
      domain: domainFor(bundle),
      types: requisitionTypes,
      primaryType: "Requisition",
      message: messageFor(bundle.requests[0].request)
    });
    const signedBundle = baseBundle({ ...bundle.requests[0], signature });
    const result = await verifyItem(signedBundle.requests[0], signedBundle);
    expect(result.ok).toBe(true);
  });

  it("rejects a purpose hash mismatch", async () => {
    const item = baseItem();
    const tampered = { ...item, purpose: "different purpose" };
    const result = await verifyItem(tampered, baseBundle(tampered));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/purpose hash/i);
  });

  it("validates a bundle shape", () => {
    const parsed = validateBundleShape(JSON.parse(JSON.stringify(baseBundle())));
    expect(parsed.chainId).toBe(5042);
    expect(parsed.requests).toHaveLength(1);
    expect(parsed.requests[0].request.amount).toBe("10000");
  });

  it("rejects a bundle with mixed buyers", () => {
    const first = baseItem();
    const second = baseItem({
      buyer: "0x000000000000000000000000000000000000F00D"
    });
    const bundle = baseBundle(first);
    bundle.requests.push(second);
    expect(() => validateBundleShape(JSON.parse(JSON.stringify(bundle)))).toThrow(
      /same buyer/i
    );
  });

  it("rejects more than 50 requests", () => {
    const bundle = baseBundle();
    bundle.requests = Array.from({ length: 51 }, (_, index) =>
      baseItem({ nonce: keccak256(toBytes(`nonce-${index}`)) })
    );
    expect(() => validateBundleShape(JSON.parse(JSON.stringify(bundle)))).toThrow(
      /more than 50/i
    );
  });

  it("rejects values that do not fit the contract fields", () => {
    const item = baseItem({ amount: ((1n << 128n) - 1n + 1n).toString() });
    expect(() => validateBundleShape(JSON.parse(JSON.stringify(baseBundle(item))))).toThrow(
      /out of range/i
    );
    const expiryItem = baseItem({ expiresAt: ((1n << 64n) - 1n + 1n).toString() });
    expect(() =>
      validateBundleShape(JSON.parse(JSON.stringify(baseBundle(expiryItem))))
    ).toThrow(/out of range/i);
  });

  it("rejects an overlong purpose", () => {
    const item = baseItem();
    item.purpose = "x".repeat(281);
    expect(() => validateBundleShape(JSON.parse(JSON.stringify(baseBundle(item))))).toThrow(
      /280 characters/i
    );
  });
});
