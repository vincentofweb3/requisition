// Shared by the web app and scripts/create-bundle.ts. No browser-only or Vite-only imports here.
import { getAddress, hashTypedData, isAddress, isHex, keccak256, parseAbi, toBytes, type Address, type Hex } from 'viem'

export const CHAIN_ID = 5042002
export const MAX_REQUESTS = 50
export const MAX_PURPOSE_CHARS = 280
export const MAX_BUNDLE_JSON_BYTES = 128 * 1024
export const MAX_SIGNATURE_HEX_CHARS = 4096
const MAX_UINT128 = (1n << 128n) - 1n

export interface BundleRequest {
  agent: Address
  buyer: Address
  vendor: Address
  /** USDC base units (6 decimals) as a decimal string. */
  amount: string
  purpose: string
  /** Must equal keccak256(toBytes(purpose)). */
  purposeHash: Hex
  /** Unix seconds. */
  expiresAt: number
  nonce: Hex
  signature: Hex
}

export interface Bundle {
  v: 1
  chainId: number
  contract: Address
  requests: BundleRequest[]
}

export class BundleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BundleError'
  }
}

export const requisitionBookAbi = parseAbi([
  'struct Requisition { address agent; address buyer; address vendor; uint128 amount; bytes32 purposeHash; uint64 expiresAt; bytes32 nonce; }',
  'function hashRequisition(Requisition r) view returns (bytes32 digest)',
  'function pay(Requisition r, bytes signature) returns (bytes32 requestId)',
  'function payBatch(Requisition[] rs, bytes[] signatures) returns (bytes32[] requestIds)',
  'function used(bytes32 requestId) view returns (bool)',
  'function records(bytes32 requestId) view returns (address agent, address buyer, address vendor, uint128 amount, bytes32 purposeHash, uint64 expiresAt, uint64 paidAt, bytes32 nonce)',
  'function totalPaid() view returns (uint256)',
  'function usdc() view returns (address)',
  'function MAX_BATCH() view returns (uint256)',
  'event RequisitionPaid(bytes32 indexed requestId, address indexed agent, address indexed buyer, address vendor, uint256 amount, bytes32 purposeHash, uint64 expiresAt, bytes32 nonce)',
  'error ZeroUsdc()',
  'error NotBuyer()',
  'error ZeroAgent()',
  'error ZeroVendor()',
  'error VendorIsContract()',
  'error ZeroAmount()',
  'error ZeroPurposeHash()',
  'error Expired()',
  'error AlreadyUsed(bytes32 requestId)',
  'error InvalidSignature()',
  'error EmptyBatch()',
  'error LengthMismatch()',
  'error BatchTooLarge()',
])

export const REQUISITION_TYPES = {
  Requisition: [
    { name: 'agent', type: 'address' },
    { name: 'buyer', type: 'address' },
    { name: 'vendor', type: 'address' },
    { name: 'amount', type: 'uint128' },
    { name: 'purposeHash', type: 'bytes32' },
    { name: 'expiresAt', type: 'uint64' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const

export function requisitionDomain(chainId: number, verifyingContract: Address) {
  return { name: 'RequisitionBook', version: '1', chainId, verifyingContract } as const
}

export type RequisitionMessage = {
  agent: Address
  buyer: Address
  vendor: Address
  amount: bigint
  purposeHash: Hex
  expiresAt: bigint
  nonce: Hex
}

/** The exact struct that is signed and passed to the contract. */
export function toMessage(r: BundleRequest): RequisitionMessage {
  return {
    agent: r.agent,
    buyer: r.buyer,
    vendor: r.vendor,
    amount: BigInt(r.amount),
    purposeHash: r.purposeHash,
    expiresAt: BigInt(r.expiresAt),
    nonce: r.nonce,
  }
}

export function hashPurpose(purpose: string): Hex {
  return keccak256(toBytes(purpose))
}

/** Local EIP-712 digest. Equals the onchain requestId. */
export function requestIdOf(chainId: number, contract: Address, r: BundleRequest): Hex {
  return hashTypedData({
    domain: requisitionDomain(chainId, contract),
    types: REQUISITION_TYPES,
    primaryType: 'Requisition',
    message: toMessage(r),
  })
}

export function purposeLength(purpose: string): number {
  return Array.from(purpose).length
}

// ---------- bundle encoding ----------

export function encodeBundle(bundle: Bundle): string {
  const bytes = new TextEncoder().encode(JSON.stringify(bundle))
  let bin = ''
  for (const byte of bytes) bin += String.fromCharCode(byte)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeBase64UrlToText(value: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new BundleError('The bundle is not valid base64url.')
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  let bin: string
  try {
    bin = atob(padded)
  } catch {
    throw new BundleError('The bundle is not valid base64url.')
  }
  if (bin.length > MAX_BUNDLE_JSON_BYTES) throw new BundleError('The bundle is larger than the 128 KB limit.')
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new BundleError('The bundle is not valid UTF-8 text.')
  }
}

/** Accepts a full link, "#b=...", "b=...", bare base64url, or raw JSON. */
export function parseBundleInput(input: string): Bundle {
  const text = input.trim()
  if (!text) throw new BundleError('Paste a bundle link or JSON first.')
  let json: string
  if (text.startsWith('{')) {
    json = text
  } else {
    const hashIndex = text.indexOf('#')
    const fragment = hashIndex >= 0 ? text.slice(hashIndex + 1) : text
    const params = new URLSearchParams(fragment)
    const encoded = params.get('b') ?? (fragment.includes('=') ? '' : fragment)
    if (!encoded) throw new BundleError('No bundle found. A bundle link ends in #b=<data>.')
    json = decodeBase64UrlToText(encoded.trim())
  }
  if (json.length > MAX_BUNDLE_JSON_BYTES) throw new BundleError('The bundle is larger than the 128 KB limit.')
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new BundleError('The bundle is not valid JSON.')
  }
  return parseBundle(raw)
}

// ---------- schema validation ----------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireAddress(value: unknown, field: string, where: string): Address {
  if (typeof value !== 'string' || !isAddress(value)) {
    throw new BundleError(`${where}: "${field}" must be a valid EVM address (checksum must match if mixed case).`)
  }
  return getAddress(value)
}

function requireBytes32(value: unknown, field: string, where: string): Hex {
  if (typeof value !== 'string' || !isHex(value, { strict: true }) || value.length !== 66) {
    throw new BundleError(`${where}: "${field}" must be a 32-byte 0x-prefixed hex string.`)
  }
  return value.toLowerCase() as Hex
}

function parseRequest(value: unknown, index: number): BundleRequest {
  const where = `Request #${index + 1}`
  if (!isRecord(value)) throw new BundleError(`${where} is not an object.`)

  const amount = value.amount
  if (typeof amount !== 'string' || !/^[1-9][0-9]*$/.test(amount)) {
    throw new BundleError(`${where}: "amount" must be a positive base-unit integer string (6 decimals, no decimal point).`)
  }
  if (BigInt(amount) > MAX_UINT128) throw new BundleError(`${where}: "amount" exceeds uint128.`)

  const purpose = value.purpose
  if (typeof purpose !== 'string' || purpose.length === 0) throw new BundleError(`${where}: "purpose" must be a non-empty string.`)
  if (purposeLength(purpose) > MAX_PURPOSE_CHARS) {
    throw new BundleError(`${where}: "purpose" is longer than ${MAX_PURPOSE_CHARS} characters.`)
  }

  const rawExpiry = value.expiresAt
  const expiresAt = typeof rawExpiry === 'string' && /^[0-9]+$/.test(rawExpiry) ? Number(rawExpiry) : rawExpiry
  if (typeof expiresAt !== 'number' || !Number.isSafeInteger(expiresAt) || expiresAt <= 0) {
    throw new BundleError(`${where}: "expiresAt" must be a positive integer of Unix seconds.`)
  }

  const signature = value.signature
  if (
    typeof signature !== 'string' ||
    !isHex(signature, { strict: true }) ||
    signature.length < 4 ||
    signature.length % 2 !== 0 ||
    signature.length > MAX_SIGNATURE_HEX_CHARS
  ) {
    throw new BundleError(`${where}: "signature" must be even-length 0x-prefixed hex.`)
  }

  return {
    agent: requireAddress(value.agent, 'agent', where),
    buyer: requireAddress(value.buyer, 'buyer', where),
    vendor: requireAddress(value.vendor, 'vendor', where),
    amount,
    purpose,
    purposeHash: requireBytes32(value.purposeHash, 'purposeHash', where),
    expiresAt,
    nonce: requireBytes32(value.nonce, 'nonce', where),
    signature: signature,
  }
}

export function parseBundle(raw: unknown): Bundle {
  if (!isRecord(raw)) throw new BundleError('The bundle must be a JSON object.')
  if (raw.v !== 1) throw new BundleError('Unsupported bundle version. Expected "v": 1.')
  if (typeof raw.chainId !== 'number' || !Number.isSafeInteger(raw.chainId)) {
    throw new BundleError('"chainId" must be an integer.')
  }
  const contract = requireAddress(raw.contract, 'contract', 'Bundle')
  if (!Array.isArray(raw.requests) || raw.requests.length === 0) {
    throw new BundleError('"requests" must be a non-empty array.')
  }
  if (raw.requests.length > MAX_REQUESTS) {
    throw new BundleError(`A bundle holds at most ${MAX_REQUESTS} requests. This one has ${raw.requests.length}.`)
  }
  return {
    v: 1,
    chainId: raw.chainId,
    contract,
    requests: raw.requests.map((entry, index) => parseRequest(entry, index)),
  }
}
