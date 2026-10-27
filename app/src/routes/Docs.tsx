import { Link } from "react-router-dom";
import { appConfig } from "../lib/config";

export function Docs() {
  return (
    <div className="page docs-page">
      <div className="page-heading">
        <span className="eyebrow">Documentation</span>
        <h1>Small surface. Explicit trust.</h1>
        <p>
          Requisition is an EIP-712 request book for agent-initiated USDC payments.
          The contract verifies an agent signature and the buyer, then transfers
          USDC directly to the vendor. It never holds funds.
        </p>
      </div>

      <div className="docs-layout">
        <aside className="docs-nav card">
          <span className="summary-label">On this page</span>
          <a href="#schema">Request schema</a>
          <a href="#contract">Contract</a>
          <a href="#cli">Agent CLI</a>
          <a href="#security">Security model</a>
          <a href="#receipts">Receipts</a>
          <a href="#self-host">Self-host</a>
          <a href="#limits">Limitations</a>
        </aside>

        <article className="docs-body">
          <section id="schema" className="card docs-section">
            <h2>Request schema</h2>
            <p>
              The agent signs typed data. The request ID is the EIP-712 digest,
              which binds the request to the chain and contract.
            </p>
            <pre>{`Requisition(
  address agent,
  address buyer,
  address vendor,
  uint128 amount,
  bytes32 purposeHash,
  uint64 expiresAt,
  bytes32 nonce
)`}</pre>
            <p>
              Domain: <span className="mono">RequisitionBook</span>, version{" "}
              <span className="mono">1</span>, chain ID{" "}
              <span className="mono">{appConfig.chainId}</span>, verifying contract{" "}
              <span className="mono">{appConfig.contract}</span>.
            </p>
            <pre>{`{
  "v": 1,
  "chainId": ${appConfig.chainId},
  "contract": "${appConfig.contract}",
  "createdAt": "2026-10-28T12:00:00Z",
  "agentLabel": "research-agent",
  "requests": [
    {
      "request": {
        "agent": "0x...",
        "buyer": "0x...",
        "vendor": "0x...",
        "amount": "10000",
        "purposeHash": "0x...",
        "expiresAt": "1790000000",
        "nonce": "0x..."
      },
      "signature": "0x...",
      "purpose": "Buy 10k API credits",
      "vendorLabel": "vendor-x"
    }
  ]
}`}</pre>
            <p>
              Amounts and expiry are decimal strings. Amount is in 6-decimal USDC
              base units. <span className="mono">purposeHash</span> must equal{" "}
              <span className="mono">keccak256(toBytes(purpose))</span>. The purpose
              is stored offchain; the chain stores only the hash.
            </p>
          </section>

          <section id="contract" className="card docs-section">
            <h2>Contract</h2>
            <p>
              <span className="mono">RequisitionBook</span> exposes{" "}
              <span className="mono">pay</span>,{" "}
              <span className="mono">payBatch</span>, and a view hash helper. It
              validates the buyer, addresses, amount, purpose, expiry, replay
              status, and signature before marking a request used and transferring
              USDC.
            </p>
            <ul>
              <li>The request ID is the EIP-712 digest and is used for replay protection.</li>
              <li>Only the named buyer can pay; the signature proves the agent intent.</li>
              <li>Batch cap is 50 and settlement is atomic.</li>
              <li>USDC moves directly from buyer to vendor; the contract balance stays zero.</li>
              <li>There is no owner, admin, upgrade, pause, fee, escrow, or refund function.</li>
              <li>SignatureChecker supports EOA and ERC-1271 agent signatures.</li>
            </ul>
            <p>
              The contract uses OpenZeppelin EIP712, SafeERC20, ReentrancyGuard, and
              SignatureChecker, with a fixed Solidity version and pinned dependency.
            </p>
          </section>

          <section id="cli" className="card docs-section">
            <h2>Agent CLI</h2>
            <p>
              The agent key is read from an environment variable or a local key
              file. It is never accepted as a plaintext command-line argument and
              never needs funds or gas.
            </p>
            <pre>{`req create \\
  --contract 0x... \\
  --buyer 0x... \\
  --vendor 0x... \\
  --amount 0.01 \\
  --purpose "Buy 10k API credits" \\
  --expires-in 1h \\
  --agent-key-env AGENT_PRIVATE_KEY \\
  --out req.json \\
  --app-url ${typeof window !== "undefined" ? window.location.origin : "https://requisition-arc.vercel.app"}

req batch --contract 0x... --input batch.json --agent-key-env AGENT_PRIVATE_KEY \\
  --out bundle.json --app-url ${typeof window !== "undefined" ? window.location.origin : "https://requisition-arc.vercel.app"}

req show bundle.json
req verify bundle.json --rpc-url https://rpc.mainnet.arc.io
req link bundle.json --app-url ${typeof window !== "undefined" ? window.location.origin : "https://requisition-arc.vercel.app"}`}</pre>
            <p>
              A batch input is a JSON array of buyer, vendor, amount, purpose, and
              optional vendor label. The CLI signs each request and produces a
              bundle link with the JSON in the URL fragment.
            </p>
          </section>

          <section id="security" className="card docs-section">
            <h2>Security model</h2>
            <p>
              The human buyer is the payer and the final approver. The agent is an
              untrusted requester: it can propose a payment, but it cannot move
              funds. The contract checks the signature and the buyer on every call.
            </p>
            <div className="security-grid">
              <div>
                <h3>Replay</h3>
                <p>The request digest is marked used before transfer. A second call reverts.</p>
              </div>
              <div>
                <h3>Tampering</h3>
                <p>Changing amount, vendor, buyer, expiry, purpose, or nonce invalidates the signature.</p>
              </div>
              <div>
                <h3>Phishing</h3>
                <p>The app shows the agent, vendor, amount, expiry, and purpose. It still cannot prove delivery.</p>
              </div>
              <div>
                <h3>Compromised agent</h3>
                <p>An attacker with the agent key can create requests, but cannot pay them. The buyer must approve.</p>
              </div>
              <div>
                <h3>USDC blocklist</h3>
                <p>A blocked address can make a transfer revert. A batch reverts atomically; no partial settlement.</p>
              </div>
              <div>
                <h3>Decimals</h3>
                <p>ERC-20 USDC uses 6 decimals on Arc. Native gas uses 18 decimals. The app never mixes them.</p>
              </div>
            </div>
            <p>
              Never put a seed phrase or private key into the app. The app only asks
              the browser wallet to approve and pay. Bundle links may expose the
              purpose text; do not include secrets.
            </p>
          </section>

          <section id="receipts" className="card docs-section">
            <h2>Receipts and proof</h2>
            <p>
              A receipt reads <span className="mono">records(requestId)</span> from
              the contract. If a transaction hash is supplied, the app fetches the
              receipt and checks for a matching{" "}
              <span className="mono">RequisitionPaid</span> event from the configured
              contract. Without a transaction hash, the record is visible but the
              transaction is not proven.
            </p>
            <p>
              The proof page reads live <span className="mono">totalPaid</span> and
              the contract&apos;s USDC balance. Mainnet batch evidence is populated
              only after a real batch.
            </p>
          </section>

          <section id="self-host" className="card docs-section">
            <h2>Self-host</h2>
            <p>
              The app is static. Build it with public environment variables and
              deploy it to any static host. No backend, database, or secret is
              required.
            </p>
            <pre>{`VITE_CHAIN_ID=5042
VITE_RPC_URL=https://rpc.mainnet.arc.io
VITE_USDC_ADDRESS=0x3600000000000000000000000000000000000000
VITE_REQUISITION_BOOK=0x...
VITE_EXPLORER_URL=https://explorer.arc.io
VITE_STUDIO_URL=https://studio.arc.io/app/...
VITE_REPO_URL=https://github.com/vincentofweb3/requisition
VITE_DEPLOYMENT_TX=0x...
VITE_EXAMPLE_TX=0x...`}</pre>
            <p>
              Mainnet is deployed separately with Arc Foundry after human approval.
              Arc Studio deploys testnet only; the Studio origin and the mainnet
              handoff are disclosed in the README.
            </p>
          </section>

          <section id="limits" className="card docs-section">
            <h2>Limitations</h2>
            <ul>
              <li>No independent audit and no production-readiness claim.</li>
              <li>No escrow, dispute, refund, cancellation, or delivery proof.</li>
              <li>The purpose is offchain and may be exposed in a bundle link.</li>
              <li>Receipt verification needs a transaction hash supplied by the user.</li>
              <li>Public RPC availability and browser wallet behavior are external dependencies.</li>
              <li>The contract cannot recover USDC sent directly to it; there is no admin.</li>
              <li>USDC blocklist behavior can make a payment or batch revert.</li>
              <li>No fiat, cards, KYC, accounting, payroll, or bank integration.</li>
            </ul>
            <p>
              Questions or issues: use the public repository link from the footer.
              <Link className="inline-link" to="/proof">
                See live proof
              </Link>
              .
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
