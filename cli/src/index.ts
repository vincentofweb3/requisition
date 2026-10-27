#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  bytesToHex,
  createPublicClient,
  hashTypedData,
  http,
  verifyTypedData,
  type Address,
  type Hex
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  CHAIN_ID,
  MAX_REQUESTS,
  bundleLink,
  domainFor,
  formatUsdc,
  messageFor,
  parseAddress,
  parseExpiresAt,
  parseExpiry,
  parseUsdcAmount,
  purposeHash,
  requisitionBookAbi,
  requisitionTypes,
  shortHex,
  validateBundle,
  type Bundle,
  type RequisitionItem,
  type RequisitionWire
} from "./schema.js";

const HELP = `Requisition agent CLI

Usage:
  req create --contract 0x... --buyer 0x... --vendor 0x... --amount 0.01 \\
    --purpose "Buy API credits" [--expires-in 1h | --expires-at 1790000000] \\
    [--agent-key-env AGENT_PRIVATE_KEY] [--agent-key-file path] \\
    [--out req.json] [--app-url https://...] [--chain-id 5042]

  req batch --contract 0x... --input batch.json [--agent-key-env ...] \\
    [--out bundle.json] [--app-url https://...] [--expires-in 1h] [--chain-id 5042]

  req show <bundle.json>
  req verify <bundle.json> [--rpc-url https://rpc.mainnet.arc.io]
  req link <bundle.json> [--app-url https://...]

Rules:
  - The agent key is read from an environment variable or file. It is never a command-line value.
  - Amounts are decimal USDC, converted to 6-decimal base units.
  - The output is a signed bundle and a #b= link for the public Desk.
  - Never commit a bundle containing vendor or purpose data you consider private.

Batch input:
  An array of { vendor, amount, purpose, buyer?, expiresIn?, expiresAt?, vendorLabel? }
  or an object { buyer, agentLabel?, expiresIn?, requests: [...] }.
`;

const options = {
  contract: { type: "string" as const },
  buyer: { type: "string" as const },
  vendor: { type: "string" as const },
  amount: { type: "string" as const },
  purpose: { type: "string" as const },
  "expires-in": { type: "string" as const },
  "expires-at": { type: "string" as const },
  "agent-key-env": { type: "string" as const },
  "agent-key-file": { type: "string" as const },
  "agent-label": { type: "string" as const },
  "vendor-label": { type: "string" as const },
  "app-url": { type: "string" as const },
  "chain-id": { type: "string" as const },
  "rpc-url": { type: "string" as const },
  input: { type: "string" as const },
  out: { type: "string" as const },
  json: { type: "boolean" as const },
  help: { type: "boolean" as const, short: "h" }
};

type Values = {
  [K in keyof typeof options]?: string | boolean;
};

function value(values: Values, key: keyof typeof options): string | undefined {
  const found = values[key];
  return typeof found === "string" ? found : undefined;
}

function flag(values: Values, key: keyof typeof options): boolean {
  return values[key] === true;
}

function requireValue(values: Values, key: keyof typeof options, label: string): string {
  const found = value(values, key);
  if (!found) throw new Error(`${label} is required.`);
  return found;
}

function parseChainId(values: Values): number {
  const raw = value(values, "chain-id");
  if (raw === undefined) return CHAIN_ID;
  const chainId = Number(raw);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error("--chain-id must be a positive integer.");
  return chainId;
}

function parseContract(values: Values): Address {
  return parseAddress(requireValue(values, "contract", "--contract"), "Contract");
}

function parseExpiryOption(values: Values, now: number): bigint {
  const relative = value(values, "expires-in");
  const absolute = value(values, "expires-at");
  if (relative && absolute) throw new Error("Use --expires-in or --expires-at, not both.");
  if (absolute) return parseExpiresAt(absolute);
  return parseExpiry(relative ?? "1h", now);
}

function normalizeKey(raw: string): Hex {
  const trimmed = raw.trim();
  const key = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("Agent key must be a 32-byte hex private key.");
  return key as Hex;
}

function loadAgent(values: Values) {
  const envName = value(values, "agent-key-env") ?? "AGENT_PRIVATE_KEY";
  const keyFile = value(values, "agent-key-file");
  let raw = process.env[envName];
  if (!raw && keyFile) raw = readFileSync(keyFile, "utf8").trim();
  if (!raw) {
    throw new Error(`No agent key found. Set ${envName} or pass --agent-key-file.`);
  }
  return privateKeyToAccount(normalizeKey(raw));
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Could not read ${path}: ${error instanceof Error ? error.message : "invalid JSON"}`);
  }
}

function loadBundle(path: string): Bundle {
  return validateBundle(readJson(path));
}

function writeBundle(bundle: Bundle, out: string | undefined, fallback: string) {
  const destination = out ?? fallback;
  const text = `${JSON.stringify(bundle, null, 2)}\n`;
  if (destination === "-") {
    process.stdout.write(text);
    return destination;
  }
  writeFileSync(destination, text, { mode: 0o600 });
  return destination;
}

function requestIdFor(item: RequisitionItem, bundle: Bundle): Hex {
  return hashTypedData({
    domain: domainFor(bundle),
    types: requisitionTypes,
    primaryType: "Requisition",
    message: messageFor(item.request)
  });
}

async function createCommand(values: Values) {
  const now = Math.floor(Date.now() / 1000);
  const chainId = parseChainId(values);
  const contract = parseContract(values);
  const buyer = parseAddress(requireValue(values, "buyer", "--buyer"), "Buyer");
  const vendor = parseAddress(requireValue(values, "vendor", "--vendor"), "Vendor");
  const amount = parseUsdcAmount(requireValue(values, "amount", "--amount"));
  const purpose = requireValue(values, "purpose", "--purpose").trim();
  if (!purpose) throw new Error("Purpose must not be empty.");
  if (purpose.length > 280) throw new Error("Purpose must be at most 280 characters.");
  const expiresAt = parseExpiryOption(values, now);
  const account = loadAgent(values);
  const request: RequisitionWire = {
    agent: account.address,
    buyer,
    vendor,
    amount: amount.toString(),
    purposeHash: purposeHash(purpose),
    expiresAt: expiresAt.toString(),
    nonce: bytesToHex(randomBytes(32))
  };
  const signature = await account.signTypedData({
    domain: { name: "RequisitionBook", version: "1", chainId, verifyingContract: contract },
    types: requisitionTypes,
    primaryType: "Requisition",
    message: messageFor(request)
  });
  const vendorLabel = value(values, "vendor-label");
  const agentLabel = value(values, "agent-label");
  const item: RequisitionItem = {
    request,
    signature,
    purpose,
    ...(vendorLabel ? { vendorLabel } : {})
  };
  const bundle: Bundle = {
    v: 1,
    chainId,
    contract,
    createdAt: new Date().toISOString(),
    ...(agentLabel ? { agentLabel } : {}),
    requests: [item]
  };
  const destination = writeBundle(bundle, value(values, "out"), "req.json");
  const appUrl = value(values, "app-url") ?? process.env.APP_URL;
  const id = requestIdFor(item, bundle);
  console.log(`Signed 1 request from ${account.address}`);
  console.log(`Request ID: ${id}`);
  console.log(`Buyer: ${buyer}`);
  console.log(`Vendor: ${vendor}${vendorLabel ? ` (${vendorLabel})` : ""}`);
  console.log(`Amount: ${formatUsdc(amount)} USDC`);
  console.log(`Purpose: ${purpose}`);
  console.log(`Expires: ${new Date(Number(expiresAt) * 1000).toISOString()}`);
  console.log(`Bundle: ${destination === "-" ? "stdout" : destination}`);
  if (appUrl) console.log(`Link: ${bundleLink(appUrl, bundle)}`);
}

type BatchEntry = {
  buyer?: string;
  vendor: string;
  amount: string;
  purpose: string;
  expiresIn?: string;
  expiresAt?: string;
  vendorLabel?: string;
};

type BatchInput = {
  buyer?: string;
  agentLabel?: string;
  expiresIn?: string;
  requests: BatchEntry[];
};

function normalizeBatchInput(raw: unknown, values: Values): BatchInput {
  if (Array.isArray(raw)) {
    return { requests: raw as BatchEntry[] };
  }
  if (!raw || typeof raw !== "object") throw new Error("Batch input must be an array or object.");
  const object = raw as Record<string, unknown>;
  if (!Array.isArray(object.requests)) throw new Error("Batch input needs a requests array.");
  return {
    ...(typeof object.buyer === "string" ? { buyer: object.buyer } : {}),
    ...(typeof object.agentLabel === "string" ? { agentLabel: object.agentLabel } : {}),
    ...(typeof object.expiresIn === "string" ? { expiresIn: object.expiresIn } : {}),
    requests: object.requests as BatchEntry[]
  };
}

async function batchCommand(values: Values) {
  const now = Math.floor(Date.now() / 1000);
  const chainId = parseChainId(values);
  const contract = parseContract(values);
  const inputPath = requireValue(values, "input", "--input");
  const input = normalizeBatchInput(readJson(inputPath), values);
  if (input.requests.length === 0) throw new Error("Batch has no requests.");
  if (input.requests.length > MAX_REQUESTS) throw new Error(`Batch has more than ${MAX_REQUESTS} requests.`);
  const account = loadAgent(values);
  const fallbackExpiresIn = value(values, "expires-in") ?? input.expiresIn ?? "1h";
  const fallbackBuyer = value(values, "buyer") ?? input.buyer;
  const items: RequisitionItem[] = [];
  for (const [index, entry] of input.requests.entries()) {
    if (!entry || typeof entry !== "object") throw new Error(`Request ${index + 1} is invalid.`);
    const buyerRaw = entry.buyer ?? fallbackBuyer;
    if (!buyerRaw) throw new Error(`Request ${index + 1} needs a buyer.`);
    const buyer = parseAddress(buyerRaw, `Request ${index + 1} buyer`);
    const vendor = parseAddress(entry.vendor, `Request ${index + 1} vendor`);
    const amount = parseUsdcAmount(entry.amount);
    const purpose = typeof entry.purpose === "string" ? entry.purpose.trim() : "";
    if (!purpose) throw new Error(`Request ${index + 1} purpose is missing.`);
    if (purpose.length > 280) throw new Error(`Request ${index + 1} purpose is too long.`);
    const expiresAt = entry.expiresAt
      ? parseExpiresAt(entry.expiresAt)
      : parseExpiry(entry.expiresIn ?? fallbackExpiresIn, now);
    const request: RequisitionWire = {
      agent: account.address,
      buyer,
      vendor,
      amount: amount.toString(),
      purposeHash: purposeHash(purpose),
      expiresAt: expiresAt.toString(),
      nonce: bytesToHex(randomBytes(32))
    };
    const signature = await account.signTypedData({
      domain: { name: "RequisitionBook", version: "1", chainId, verifyingContract: contract },
      types: requisitionTypes,
      primaryType: "Requisition",
      message: messageFor(request)
    });
    const vendorLabel = entry.vendorLabel ?? value(values, "vendor-label");
    items.push({
      request,
      signature,
      purpose,
      ...(vendorLabel ? { vendorLabel } : {})
    });
  }
  const firstBuyer = items[0]!.request.buyer.toLowerCase();
  if (items.some((item) => item.request.buyer.toLowerCase() !== firstBuyer)) {
    throw new Error("All requests in a batch must share the same buyer.");
  }
  const agentLabel = value(values, "agent-label") ?? input.agentLabel;
  const bundle: Bundle = {
    v: 1,
    chainId,
    contract,
    createdAt: new Date().toISOString(),
    ...(agentLabel ? { agentLabel } : {}),
    requests: items
  };
  const destination = writeBundle(bundle, value(values, "out"), "bundle.json");
  const appUrl = value(values, "app-url") ?? process.env.APP_URL;
  console.log(`Signed ${items.length} request${items.length === 1 ? "" : "s"} from ${account.address}`);
  for (const [index, item] of items.entries()) {
    console.log(
      `${index + 1}. ${formatUsdc(BigInt(item.request.amount))} USDC -> ${item.request.vendor} | ${item.purpose} | ${requestIdFor(item, bundle)}`
    );
  }
  console.log(`Bundle: ${destination === "-" ? "stdout" : destination}`);
  if (appUrl) console.log(`Link: ${bundleLink(appUrl, bundle)}`);
}

function showCommand(values: Values, path: string) {
  const bundle = loadBundle(path);
  if (flag(values, "json")) {
    console.log(JSON.stringify(bundle, null, 2));
    return;
  }
  console.log(`Bundle v${bundle.v} | chain ${bundle.chainId} | ${bundle.contract}`);
  console.log(`Created: ${bundle.createdAt}${bundle.agentLabel ? ` | ${bundle.agentLabel}` : ""}`);
  console.log(`Requests: ${bundle.requests.length}`);
  for (const [index, item] of bundle.requests.entries()) {
    console.log("");
    console.log(`#${index + 1} ${formatUsdc(BigInt(item.request.amount))} USDC`);
    console.log(`  Agent:   ${item.request.agent}`);
    console.log(`  Buyer:   ${item.request.buyer}`);
    console.log(`  Vendor:  ${item.request.vendor}${item.vendorLabel ? ` (${item.vendorLabel})` : ""}`);
    console.log(`  Purpose: ${item.purpose}`);
    console.log(`  Expires: ${new Date(Number(item.request.expiresAt) * 1000).toISOString()}`);
    console.log(`  Nonce:   ${item.request.nonce}`);
    console.log(`  ID:      ${requestIdFor(item, bundle)}`);
    console.log(`  Sig:     ${shortHex(item.signature, 10)}`);
  }
}

async function verifyCommand(values: Values, path: string) {
  const bundle = loadBundle(path);
  const now = Math.floor(Date.now() / 1000);
  const rpcUrl = value(values, "rpc-url");
  const client = rpcUrl ? createPublicClient({ transport: http(rpcUrl) }) : undefined;
  let ok = true;
  for (const [index, item] of bundle.requests.entries()) {
    const id = requestIdFor(item, bundle);
    const reasons: string[] = [];
    if (purposeHash(item.purpose) !== item.request.purposeHash) reasons.push("purpose hash mismatch");
    if (BigInt(item.request.expiresAt) <= BigInt(now)) reasons.push("expired");
    try {
      const valid = await verifyTypedData({
        address: item.request.agent,
        domain: domainFor(bundle),
        types: requisitionTypes,
        primaryType: "Requisition",
        message: messageFor(item.request),
        signature: item.signature
      });
      if (!valid) reasons.push("signature does not match the agent");
    } catch {
      reasons.push("signature could not be checked");
    }
    if (client) {
      try {
        const onchain = await client.readContract({
          address: bundle.contract,
          abi: requisitionBookAbi,
          functionName: "hashRequisition",
          args: [messageFor(item.request)]
        });
        if (onchain.toLowerCase() !== id.toLowerCase()) reasons.push("onchain digest mismatch");
      } catch {
        reasons.push("could not read the contract digest");
      }
    }
    const status = reasons.length === 0 ? "OK" : `FAIL: ${reasons.join(", ")}`;
    console.log(`#${index + 1} ${status} | ${id}`);
    if (reasons.length > 0) ok = false;
  }
  if (!ok) process.exitCode = 1;
}

function linkCommand(values: Values, path: string) {
  const bundle = loadBundle(path);
  const appUrl = value(values, "app-url") ?? process.env.APP_URL;
  if (!appUrl) throw new Error("--app-url or APP_URL is required.");
  console.log(bundleLink(appUrl, bundle));
}

async function main() {
  const parsed = parseArgs({ args: process.argv.slice(2), options, allowPositionals: true });
  const values = parsed.values as Values;
  if (flag(values, "help") || parsed.positionals.length === 0) {
    console.log(HELP);
    return;
  }
  const command = parsed.positionals[0];
  const file = parsed.positionals[1];
  switch (command) {
    case "create":
      await createCommand(values);
      return;
    case "batch":
      await batchCommand(values);
      return;
    case "show":
      if (!file) throw new Error("req show needs a bundle file.");
      showCommand(values, file);
      return;
    case "verify":
      if (!file) throw new Error("req verify needs a bundle file.");
      await verifyCommand(values, file);
      return;
    case "link":
      if (!file) throw new Error("req link needs a bundle file.");
      linkCommand(values, file);
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Unknown error.");
  process.exitCode = 1;
});
