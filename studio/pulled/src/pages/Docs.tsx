import type { ReactNode } from 'react'
import { Card, PageTitle } from '@/components/ui'
import { BOOK_ADDRESS } from '@/lib/env'
import { MAX_PURPOSE_CHARS, MAX_REQUESTS } from '@/lib/requisition'

function Code({ children }: { children: ReactNode }) {
  return <code className="mono rounded bg-surface-muted px-1.5 py-0.5 text-[12.5px]">{children}</code>
}

const FIELDS: Array<[string, string, string]> = [
  ['v', 'number', 'Always 1.'],
  ['chainId', 'number', 'Must be 5042002 (Arc Testnet).'],
  ['contract', 'address', 'The RequisitionBook the requests were signed for.'],
  ['requests', 'array', `1 to ${MAX_REQUESTS} requests.`],
]

const REQUEST_FIELDS: Array<[string, string, string]> = [
  ['agent', 'address', 'Signer of the request. Must be an EOA or an ERC-1271 account.'],
  ['buyer', 'address', 'The only wallet allowed to pay this request.'],
  ['vendor', 'address', 'Receives the USDC directly. Not zero, not the contract.'],
  ['amount', 'string', 'USDC base units (6 decimals) as a positive integer string. "1500000" is 1.5 USDC. No decimal point.'],
  ['purpose', 'string', `Human-readable reason, 1 to ${MAX_PURPOSE_CHARS} characters. Never sent onchain.`],
  ['purposeHash', 'bytes32', 'Must equal keccak256(toBytes(purpose)). This is what the contract records.'],
  ['expiresAt', 'number', 'Unix seconds. The request is payable while expiresAt is greater than the block time.'],
  ['nonce', 'bytes32', '32 random bytes chosen by the agent so identical requests stay distinct.'],
  ['signature', 'hex', 'EIP-712 signature over the seven signed fields (everything above except purpose).'],
]

function Table({ rows }: { rows: Array<[string, string, string]> }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead>
          <tr className="label-caps">
            <th className="py-2 pr-4 font-semibold">Field</th>
            <th className="py-2 pr-4 font-semibold">Type</th>
            <th className="py-2 font-semibold">Meaning</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line align-top">
          {rows.map(([name, type, meaning]) => (
            <tr key={name}>
              <td className="py-2 pr-4">
                <Code>{name}</Code>
              </td>
              <td className="py-2 pr-4 text-muted">{type}</td>
              <td className="py-2 text-ink-2">{meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Docs() {
  return (
    <div className="space-y-6">
      <PageTitle eyebrow="Docs" title="Schema, security and limits">
        What an agent must produce, what the Desk checks, and what this system does not do.
      </PageTitle>

      <Card>
        <h2 className="display text-xl font-semibold">Bundle format</h2>
        <p className="mt-2 max-w-[70ch] text-sm text-muted">
          A bundle is JSON, encoded as base64url (UTF-8) in the link fragment: <Code>/desk#b=&lt;base64url&gt;</Code>. The fragment
          is never sent to a server. Raw JSON and full links can also be pasted into the Desk.
        </p>
        <h3 className="mt-5 text-sm font-semibold">Bundle</h3>
        <Table rows={FIELDS} />
        <h3 className="mt-5 text-sm font-semibold">Request</h3>
        <Table rows={REQUEST_FIELDS} />
        <p className="mt-4 max-w-[70ch] text-sm text-muted">
          Caps: {MAX_REQUESTS} requests, {MAX_PURPOSE_CHARS} purpose characters, 128 KB decoded. Studio share frames may truncate a
          very long fragment, so large bundles are more reliable pasted into the Desk than opened as a link.
        </p>
      </Card>

      <Card>
        <h2 className="display text-xl font-semibold">Signing</h2>
        <p className="mt-2 max-w-[70ch] text-sm text-muted">
          EIP-712 domain: name <Code>RequisitionBook</Code>, version <Code>1</Code>, chain id <Code>5042002</Code>, verifying
          contract <Code>{BOOK_ADDRESS ?? 'the deployed contract'}</Code>. Type:
        </p>
        <pre className="mono mt-3 overflow-x-auto rounded-2xl bg-surface-muted p-3 text-[12.5px] text-ink">
          Requisition(address agent,address buyer,address vendor,uint128 amount,bytes32 purposeHash,uint64 expiresAt,bytes32 nonce)
        </pre>
        <p className="mt-3 max-w-[70ch] text-sm text-muted">
          The digest is also the request id. To create a bundle from a script, set <Code>AGENT_PRIVATE_KEY</Code> in your agent’s
          environment and run <Code>bun run bundle:create requests.json</Code>. The key is read from the environment and never
          printed or sent anywhere.
        </p>
      </Card>

      <Card>
        <h2 className="display text-xl font-semibold">Security model</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-2">
          <li>The contract never holds USDC. Each payment is one transfer from buyer to vendor.</li>
          <li>Only the buyer named in a request can submit it, so a leaked bundle cannot be paid by someone else.</li>
          <li>The signature covers the chain, the contract, the amount, the vendor, the purpose hash, the expiry and the nonce. Changing any of them invalidates it.</li>
          <li>Each digest can be paid once. A replay or a duplicate inside a batch reverts.</li>
          <li>Batches are atomic and capped at 50. Pays are non-reentrant.</li>
          <li>There is no owner, admin, upgrade, fee, pause, withdraw, refund or cancel.</li>
          <li>The Desk asks you to approve exactly the selected total, never an unlimited amount.</li>
          <li>The Desk verifies everything in your browser first, then simulates the transaction before asking your wallet to sign it.</li>
          <li>Only an injected browser wallet is supported. The app never asks for a seed phrase or private key.</li>
        </ul>
      </Card>

      <Card>
        <h2 className="display text-xl font-semibold">Limitations</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-2">
          <li>Arc Testnet only. No mainnet deployment.</li>
          <li>No third-party audit. The code has tests, but that is not an audit.</li>
          <li>A signed request cannot be cancelled before its expiry. Prefer short expiries.</li>
          <li>The purpose text lives only in the bundle. Onchain, only its hash is recorded.</li>
          <li>If USDC’s issuer blocklists an address, payments involving it revert.</li>
          <li>ERC-6492 wrapped signatures (undeployed smart accounts) are not accepted.</li>
          <li>No backend: the Desk uses the public Arc Testnet RPC and can be rate limited.</li>
        </ul>
      </Card>
    </div>
  )
}
