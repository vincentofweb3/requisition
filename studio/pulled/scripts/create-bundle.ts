/**
 * Agent-side helper: signs purchase requests (EIP-712) and prints a bundle link for the buyer.
 *
 *   AGENT_PRIVATE_KEY=0x... APP_URL=https://your-app bun run bundle:create requests.json
 *
 * requests.json is an array of { buyer, vendor, amount, purpose, ttlSeconds? } where
 * amount is a decimal USDC string such as "12.50". The agent key never leaves this process.
 */
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { isAddress, toHex, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { parseUsdc } from '../src/onchain-money'
import {
  CHAIN_ID,
  MAX_PURPOSE_CHARS,
  MAX_REQUESTS,
  REQUISITION_TYPES,
  encodeBundle,
  hashPurpose,
  parseBundle,
  purposeLength,
  requisitionDomain,
  toMessage,
  type Bundle,
  type BundleRequest,
} from '../src/lib/requisition'

interface Input {
  buyer: string
  vendor: string
  amount: string
  purpose: string
  ttlSeconds?: number
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

const file = process.argv[2]
if (!file) fail('Usage: bun run bundle:create <requests.json>')

const key = process.env.AGENT_PRIVATE_KEY
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) fail('Set AGENT_PRIVATE_KEY to a 0x-prefixed 32-byte hex key.')

const contract = process.env.VITE_REQUISITION_BOOK_ADDRESS
if (!contract || !isAddress(contract)) fail('Set VITE_REQUISITION_BOOK_ADDRESS to the deployed RequisitionBook address.')

const inputs = JSON.parse(readFileSync(file, 'utf8')) as Input[]
if (!Array.isArray(inputs) || inputs.length === 0) fail('The input file must be a non-empty array.')
if (inputs.length > MAX_REQUESTS) fail(`At most ${MAX_REQUESTS} requests per bundle.`)

const agent = privateKeyToAccount(key as Hex)
const verifyingContract = contract
const domain = requisitionDomain(CHAIN_ID, verifyingContract)
const nowSeconds = Math.floor(Date.now() / 1000)

const requests: BundleRequest[] = []
for (const [i, input] of inputs.entries()) {
  const where = `Request #${i + 1}`
  if (!isAddress(input.buyer)) fail(`${where}: buyer is not an address.`)
  if (!isAddress(input.vendor)) fail(`${where}: vendor is not an address.`)
  if (typeof input.purpose !== 'string' || input.purpose.length === 0) fail(`${where}: purpose is required.`)
  if (purposeLength(input.purpose) > MAX_PURPOSE_CHARS) fail(`${where}: purpose is over ${MAX_PURPOSE_CHARS} characters.`)
  const amount = parseUsdc(input.amount)
  if (amount <= 0n) fail(`${where}: amount must be positive.`)
  const ttl = input.ttlSeconds ?? 3600
  if (!Number.isInteger(ttl) || ttl < 60) fail(`${where}: ttlSeconds must be an integer of at least 60.`)

  const unsigned = {
    agent: agent.address,
    buyer: input.buyer,
    vendor: input.vendor,
    amount: amount.toString(),
    purpose: input.purpose,
    purposeHash: hashPurpose(input.purpose),
    expiresAt: nowSeconds + ttl,
    nonce: toHex(randomBytes(32)),
  }
  const signature = await agent.signTypedData({
    domain,
    types: REQUISITION_TYPES,
    primaryType: 'Requisition',
    message: toMessage({ ...unsigned, signature: '0x' }),
  })
  requests.push({ ...unsigned, signature })
}

const bundle: Bundle = parseBundle({ v: 1, chainId: CHAIN_ID, contract: verifyingContract, requests })
const base = (process.env.APP_URL ?? '').replace(/\/+$/, '')
console.log(JSON.stringify(bundle, null, 2))
console.error(`\nAgent: ${agent.address}`)
console.error(`Link:  ${base || '<your app url>'}/desk#b=${encodeBundle(bundle)}`)
