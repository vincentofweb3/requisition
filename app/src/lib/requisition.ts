import {
  getAddress,
  hashTypedData,
  isAddress,
  keccak256,
  toBytes,
  verifyTypedData,
  type Address,
  type Hex
} from "viem";

export const MAX_BUNDLE_REQUESTS = 50;
export const MAX_PURPOSE_LENGTH = 280;
const MAX_UINT128 = (1n << 128n) - 1n;
const MAX_UINT64 = (1n << 64n) - 1n;

export type RequisitionWire = {
  agent: Address;
  buyer: Address;
  vendor: Address;
  amount: string;
  purposeHash: Hex;
  expiresAt: string;
  nonce: Hex;
};

export type RequisitionMessage = {
  agent: Address;
  buyer: Address;
  vendor: Address;
  amount: bigint;
  purposeHash: Hex;
  expiresAt: bigint;
  nonce: Hex;
};

export type RequisitionItem = {
  request: RequisitionWire;
  signature: Hex;
  purpose: string;
  vendorLabel?: string;
};

export type Bundle = {
  v: 1;
  chainId: number;
  contract: Address;
  createdAt: string;
  agentLabel?: string;
  requests: RequisitionItem[];
};

export type Verification = {
  ok: boolean;
  error?: string;
  requestId: Hex;
};

export const requisitionTypes = {
  Requisition: [
    { name: "agent", type: "address" },
    { name: "buyer", type: "address" },
    { name: "vendor", type: "address" },
    { name: "amount", type: "uint128" },
    { name: "purposeHash", type: "bytes32" },
    { name: "expiresAt", type: "uint64" },
    { name: "nonce", type: "bytes32" }
  ]
} as const;

export function domainFor(bundle: Pick<Bundle, "chainId" | "contract">) {
  return {
    name: "RequisitionBook",
    version: "1",
    chainId: bundle.chainId,
    verifyingContract: bundle.contract
  } as const;
}

export function messageFor(request: RequisitionWire): RequisitionMessage {
  return {
    agent: request.agent,
    buyer: request.buyer,
    vendor: request.vendor,
    amount: BigInt(request.amount),
    purposeHash: request.purposeHash,
    expiresAt: BigInt(request.expiresAt),
    nonce: request.nonce
  };
}

export function purposeHash(purpose: string): Hex {
  return keccak256(toBytes(purpose));
}

export function requestIdFor(item: RequisitionItem, bundle: Bundle): Hex {
  return hashTypedData({
    domain: domainFor(bundle),
    types: requisitionTypes,
    primaryType: "Requisition",
    message: messageFor(item.request)
  });
}

export function isExpired(
  item: RequisitionItem,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  return BigInt(nowSeconds) >= BigInt(item.request.expiresAt);
}

export async function verifyItem(
  item: RequisitionItem,
  bundle: Bundle
): Promise<Verification> {
  const requestId = requestIdFor(item, bundle);
  const expectedPurposeHash = purposeHash(item.purpose);
  if (expectedPurposeHash.toLowerCase() !== item.request.purposeHash.toLowerCase()) {
    return {
      ok: false,
      error: "Purpose hash does not match the purpose text.",
      requestId
    };
  }

  try {
    const ok = await verifyTypedData({
      address: item.request.agent,
      domain: domainFor(bundle),
      types: requisitionTypes,
      primaryType: "Requisition",
      message: messageFor(item.request),
      signature: item.signature
    });
    return ok
      ? { ok: true, requestId }
      : {
          ok: false,
          error: "Signature does not match the named agent.",
          requestId
        };
  } catch {
    return {
      ok: false,
      error: "Signature could not be verified.",
      requestId
    };
  }
}

export function validateBundleShape(value: unknown): Bundle {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Bundle must be a JSON object.");
  }
  const raw = value as Record<string, unknown>;
  if (raw.v !== 1) throw new Error("Unsupported bundle version.");
  const chainId = Number(raw.chainId);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new Error("Bundle chain ID is invalid.");
  }
  if (typeof raw.contract !== "string" || !isAddress(raw.contract)) {
    throw new Error("Bundle contract address is invalid.");
  }
  const contract = getAddress(raw.contract);
  if (contract === "0x0000000000000000000000000000000000000000") {
    throw new Error("Bundle contract address is zero.");
  }
  if (typeof raw.createdAt !== "string" || raw.createdAt.length === 0) {
    throw new Error("Bundle creation time is missing.");
  }
  if (!Array.isArray(raw.requests) || raw.requests.length === 0) {
    throw new Error("Bundle has no requests.");
  }
  if (raw.requests.length > MAX_BUNDLE_REQUESTS) {
    throw new Error(`Bundle has more than ${MAX_BUNDLE_REQUESTS} requests.`);
  }
  if (raw.agentLabel !== undefined && typeof raw.agentLabel !== "string") {
    throw new Error("Agent label is invalid.");
  }

  const requests = raw.requests.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Request ${index + 1} is not an object.`);
    }
    const item = entry as Record<string, unknown>;
    const request = item.request;
    if (!request || typeof request !== "object" || Array.isArray(request)) {
      throw new Error(`Request ${index + 1} is missing its request payload.`);
    }
    const fields = request as Record<string, unknown>;
    const agent = parseAddress(fields.agent, `Request ${index + 1} agent`);
    const buyer = parseAddress(fields.buyer, `Request ${index + 1} buyer`);
    const vendor = parseAddress(fields.vendor, `Request ${index + 1} vendor`);
    const amount = parsePositiveInteger(fields.amount, `Request ${index + 1} amount`);
    const expiresAt = parseInteger(fields.expiresAt, `Request ${index + 1} expiry`);
    if (expiresAt > MAX_UINT64) {
      throw new Error(`Request ${index + 1} expiry is out of range.`);
    }
    const purposeHashValue = parseBytes32(fields.purposeHash, `Request ${index + 1} purpose hash`);
    const nonce = parseBytes32(fields.nonce, `Request ${index + 1} nonce`);
    const purpose = parsePurpose(item.purpose, index);
    if (typeof item.signature !== "string" || !/^0x[0-9a-fA-F]*$/.test(item.signature)) {
      throw new Error(`Request ${index + 1} signature is invalid.`);
    }
    if (item.vendorLabel !== undefined && typeof item.vendorLabel !== "string") {
      throw new Error(`Request ${index + 1} vendor label is invalid.`);
    }

    return {
      request: {
        agent,
        buyer,
        vendor,
        amount: amount.toString(),
        purposeHash: purposeHashValue,
        expiresAt: expiresAt.toString(),
        nonce
      },
      signature: item.signature as Hex,
      purpose,
      ...(typeof item.vendorLabel === "string"
        ? { vendorLabel: item.vendorLabel }
        : {})
    };
  });

  const firstBuyer = requests[0].request.buyer.toLowerCase();
  if (requests.some((item) => item.request.buyer.toLowerCase() !== firstBuyer)) {
    throw new Error("All requests in a bundle must share the same buyer.");
  }

  return {
    v: 1,
    chainId,
    contract,
    createdAt: raw.createdAt,
    ...(typeof raw.agentLabel === "string" ? { agentLabel: raw.agentLabel } : {}),
    requests
  };
}

function parseAddress(value: unknown, label: string): Address {
  if (typeof value !== "string" || !isAddress(value)) {
    throw new Error(`${label} is invalid.`);
  }
  const address = getAddress(value);
  if (address === "0x0000000000000000000000000000000000000000") {
    throw new Error(`${label} is zero.`);
  }
  return address;
}

function parsePositiveInteger(value: unknown, label: string): bigint {
  const parsed = parseInteger(value, label);
  if (parsed <= 0n) throw new Error(`${label} must be greater than zero.`);
  if (parsed > MAX_UINT128) throw new Error(`${label} is out of range.`);
  return parsed;
}

function parseInteger(value: unknown, label: string): bigint {
  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) {
    throw new Error(`${label} must be a decimal string.`);
  }
  return BigInt(value);
}

function parseBytes32(value: unknown, label: string): Hex {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${label} must be 32 bytes.`);
  }
  if (/^0x0{64}$/.test(value)) throw new Error(`${label} is zero.`);
  return value as Hex;
}

function parsePurpose(value: unknown, index: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Request ${index + 1} purpose is missing.`);
  }
  const purpose = value.trim();
  if (purpose.length > MAX_PURPOSE_LENGTH) {
    throw new Error(
      `Request ${index + 1} purpose is longer than ${MAX_PURPOSE_LENGTH} characters.`
    );
  }
  return purpose;
}
