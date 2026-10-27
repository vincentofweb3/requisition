import { getAddress, isAddress, keccak256, parseUnits, toBytes, type Address, type Hex } from "viem";

export const CHAIN_ID = 5042;
export const MAX_REQUESTS = 50;
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

export const requisitionBookAbi = [
  {
    type: "function",
    name: "hashRequisition",
    stateMutability: "view",
    inputs: [
      {
        name: "r",
        type: "tuple",
        components: [
          { name: "agent", type: "address" },
          { name: "buyer", type: "address" },
          { name: "vendor", type: "address" },
          { name: "amount", type: "uint128" },
          { name: "purposeHash", type: "bytes32" },
          { name: "expiresAt", type: "uint64" },
          { name: "nonce", type: "bytes32" }
        ]
      }
    ],
    outputs: [{ name: "digest", type: "bytes32" }]
  }
] as const;

export function domainFor(bundle: Pick<Bundle, "chainId" | "contract">) {
  return {
    name: "RequisitionBook",
    version: "1",
    chainId: bundle.chainId,
    verifyingContract: bundle.contract
  } as const;
}

export function messageFor(request: RequisitionWire) {
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

export function parseAddress(value: string, label: string): Address {
  if (!isAddress(value)) throw new Error(`${label} is not a valid address.`);
  const address = getAddress(value);
  if (address === "0x0000000000000000000000000000000000000000") {
    throw new Error(`${label} is the zero address.`);
  }
  return address;
}

export function parseUsdcAmount(value: string): bigint {
  if (!/^[0-9]+(?:\.[0-9]{1,6})?$/.test(value)) {
    throw new Error("Amount must be a decimal USDC value with at most 6 decimal places.");
  }
  const amount = parseUnits(value, 6);
  if (amount <= 0n) throw new Error("Amount must be greater than zero.");
  if (amount > MAX_UINT128) throw new Error("Amount exceeds uint128.");
  return amount;
}

export function formatUsdc(value: bigint): string {
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function parseExpiry(value: string, now = Math.floor(Date.now() / 1000)): bigint {
  const match = /^([0-9]+)(s|m|h|d)$/.exec(value.trim());
  if (!match) throw new Error("Expiry must look like 30m, 1h, or 1d.");
  const amount = BigInt(match[1]!);
  const unit = match[2]!;
  const seconds = unit === "s" ? 1n : unit === "m" ? 60n : unit === "h" ? 3600n : 86400n;
  const expiresAt = BigInt(now) + amount * seconds;
  if (expiresAt <= BigInt(now)) throw new Error("Expiry must be in the future.");
  if (expiresAt > MAX_UINT64) throw new Error("Expiry exceeds uint64.");
  return expiresAt;
}

export function parseExpiresAt(value: string): bigint {
  if (!/^[0-9]+$/.test(value)) throw new Error("Expiry must be a Unix timestamp in seconds.");
  const expiresAt = BigInt(value);
  if (expiresAt <= BigInt(Math.floor(Date.now() / 1000))) throw new Error("Expiry must be in the future.");
  if (expiresAt > MAX_UINT64) throw new Error("Expiry exceeds uint64.");
  return expiresAt;
}

export function validateBundle(value: unknown): Bundle {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Bundle must be a JSON object.");
  }
  const raw = value as Record<string, unknown>;
  if (raw.v !== 1) throw new Error("Unsupported bundle version.");
  const chainId = Number(raw.chainId);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new Error("Bundle chain ID is invalid.");
  }
  const contract = parseAddress(String(raw.contract ?? ""), "Bundle contract");
  if (typeof raw.createdAt !== "string" || !raw.createdAt) throw new Error("Bundle createdAt is missing.");
  if (raw.agentLabel !== undefined && typeof raw.agentLabel !== "string") {
    throw new Error("Bundle agentLabel is invalid.");
  }
  if (!Array.isArray(raw.requests) || raw.requests.length === 0) throw new Error("Bundle has no requests.");
  if (raw.requests.length > MAX_REQUESTS) throw new Error(`Bundle has more than ${MAX_REQUESTS} requests.`);

  const requests: RequisitionItem[] = raw.requests.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Request ${index + 1} is not an object.`);
    }
    const item = entry as Record<string, unknown>;
    if (!item.request || typeof item.request !== "object" || Array.isArray(item.request)) {
      throw new Error(`Request ${index + 1} is missing its request payload.`);
    }
    const req = item.request as Record<string, unknown>;
    const agent = parseAddress(String(req.agent ?? ""), `Request ${index + 1} agent`);
    const buyer = parseAddress(String(req.buyer ?? ""), `Request ${index + 1} buyer`);
    const vendor = parseAddress(String(req.vendor ?? ""), `Request ${index + 1} vendor`);
    if (typeof req.amount !== "string" || !/^[0-9]+$/.test(req.amount)) {
      throw new Error(`Request ${index + 1} amount must be a base-unit integer string.`);
    }
    const amount = BigInt(req.amount);
    if (amount <= 0n || amount > MAX_UINT128) throw new Error(`Request ${index + 1} amount is out of range.`);
    if (typeof req.expiresAt !== "string" || !/^[0-9]+$/.test(req.expiresAt)) {
      throw new Error(`Request ${index + 1} expiresAt must be a Unix timestamp string.`);
    }
    const expiresAt = BigInt(req.expiresAt);
    if (expiresAt <= 0n || expiresAt > MAX_UINT64) throw new Error(`Request ${index + 1} expiry is out of range.`);
    if (typeof req.purposeHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(req.purposeHash)) {
      throw new Error(`Request ${index + 1} purposeHash must be 32 bytes.`);
    }
    if (typeof req.nonce !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(req.nonce)) {
      throw new Error(`Request ${index + 1} nonce must be 32 bytes.`);
    }
    if (typeof item.purpose !== "string" || !item.purpose.trim()) {
      throw new Error(`Request ${index + 1} purpose is missing.`);
    }
    const purpose = item.purpose.trim();
    if (purpose.length > MAX_PURPOSE_LENGTH) throw new Error(`Request ${index + 1} purpose is too long.`);
    if (typeof item.signature !== "string" || !/^0x[0-9a-fA-F]+$/.test(item.signature)) {
      throw new Error(`Request ${index + 1} signature is invalid.`);
    }
    if (item.vendorLabel !== undefined && typeof item.vendorLabel !== "string") {
      throw new Error(`Request ${index + 1} vendorLabel is invalid.`);
    }
    return {
      request: {
        agent,
        buyer,
        vendor,
        amount: req.amount,
        purposeHash: req.purposeHash as Hex,
        expiresAt: req.expiresAt,
        nonce: req.nonce as Hex
      },
      signature: item.signature as Hex,
      purpose,
      ...(typeof item.vendorLabel === "string" ? { vendorLabel: item.vendorLabel } : {})
    };
  });

  const firstBuyer = requests[0]!.request.buyer.toLowerCase();
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

export function encodeBundle(bundle: Bundle): string {
  return Buffer.from(JSON.stringify(bundle), "utf8").toString("base64url");
}

export function bundleLink(appUrl: string, bundle: Bundle): string {
  return `${appUrl.replace(/\/+$/, "")}/desk#b=${encodeBundle(bundle)}`;
}

export function shortHex(value: string, size = 8): string {
  return value.length <= 2 + size * 2 ? value : `${value.slice(0, 2 + size)}...${value.slice(-size)}`;
}
