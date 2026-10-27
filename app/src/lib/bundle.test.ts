import { describe, expect, it } from "vitest";
import { decodeBundle, encodeBundle, readBundleFromLocation } from "./bundle";
import { purposeHash, type Bundle } from "./requisition";

const bundle: Bundle = {
  v: 1,
  chainId: 5042,
  contract: "0x0000000000000000000000000000000000001234",
  createdAt: "2026-10-26T12:00:00Z",
  requests: [
    {
      request: {
        agent: "0x000000000000000000000000000000000000bEEF",
        buyer: "0x000000000000000000000000000000000000cafE",
        vendor: "0x000000000000000000000000000000000000F00D",
        amount: "10000",
        purposeHash: purposeHash("api credits"),
        expiresAt: "1800003600",
        nonce: "0x1111111111111111111111111111111111111111111111111111111111111111"
      },
      signature: "0x",
      purpose: "api credits",
      vendorLabel: "vendor-x"
    }
  ]
};

describe("bundle", () => {
  it("round-trips bundle JSON through base64url", () => {
    const encoded = encodeBundle(bundle);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeBundle(encoded)).toEqual(bundle);
  });

  it("reads from a URL fragment", () => {
    const encoded = encodeBundle(bundle);
    expect(readBundleFromLocation("", `#b=${encoded}`)).toEqual(bundle);
  });

  it("reads from a query parameter", () => {
    const encoded = encodeBundle(bundle);
    expect(readBundleFromLocation(`?b=${encoded}`, "")).toEqual(bundle);
  });

  it("rejects an invalid base64url value", () => {
    expect(() => decodeBundle("not-base64!")).toThrow();
  });

  it("preserves a purpose hash mismatch for the desk to block", () => {
    const bad = JSON.parse(JSON.stringify(bundle)) as Bundle;
    bad.requests[0].request.purposeHash =
      "0x2222222222222222222222222222222222222222222222222222222222222222";
    expect(() => decodeBundle(encodeBundle(bad))).not.toThrow();
  });
});
