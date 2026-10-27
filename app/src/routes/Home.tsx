import { Link, useLocation } from "react-router-dom";
import { useReadContract } from "wagmi";
import { appConfig, isConfigured } from "../lib/config";
import { erc20Abi, requisitionBookAbi } from "../lib/contract";
import { formatUsdc, shortAddress } from "../lib/format";

export function Home() {
  const location = useLocation();
  const hasBundle = location.hash.includes("b=");
  const { data: totalPaid } = useReadContract({
    address: appConfig.contract,
    abi: requisitionBookAbi,
    functionName: "totalPaid",
    query: { enabled: isConfigured }
  });
  const { data: contractBalance } = useReadContract({
    address: appConfig.usdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [appConfig.contract],
    query: { enabled: isConfigured }
  });

  return (
    <div className="page home-page">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Agent commerce, with a human in the loop</span>
          <h1>
            Your agent asks.
            <br />
            You approve.
            <br />
            USDC settles.
          </h1>
          <p className="lede">
            A typed purchase request signed by an agent. A human buyer reviews the
            exact vendor, amount, purpose, and expiry. Payment goes directly from
            buyer to vendor on Arc. No agent wallet, no custody, no escrow.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" to={hasBundle ? `/desk${location.hash}` : "/desk"}>
              {hasBundle ? "Review this bundle" : "Open the desk"}
            </Link>
            <Link className="button button-secondary" to="/proof">
              See live proof
            </Link>
            <a className="button button-ghost" href="#how-it-works">
              How it works
            </a>
          </div>
          <div className="hero-meta">
            <span>Arc {appConfig.isTestnet ? "testnet" : "mainnet"}</span>
            <span aria-hidden="true">/</span>
            <span>USDC settles directly to vendors</span>
            <span aria-hidden="true">/</span>
            <span>No admin keys</span>
          </div>
        </div>

        <div className="hero-card">
          <div className="hero-card-top">
            <span className="status-dot" />
            <span>Requisition preview</span>
            <span className="mono subtle">EIP-712</span>
          </div>
          <div className="preview-request">
            <div className="preview-label">Agent request</div>
            <div className="preview-purpose">Buy 10k API credits</div>
            <div className="preview-grid">
              <div>
                <span>Buyer</span>
                <strong className="mono">you.arc</strong>
              </div>
              <div>
                <span>Vendor</span>
                <strong className="mono">vendor.arc</strong>
              </div>
              <div>
                <span>Amount</span>
                <strong>0.01 USDC</strong>
              </div>
              <div>
                <span>Expires</span>
                <strong>in 24h</strong>
              </div>
            </div>
          </div>
          <div className="preview-signature">
            <span>Signed by agent</span>
            <span className="mono">0x7a2f...91c4</span>
          </div>
          <div className="preview-action">Buyer approves exact total</div>
        </div>
      </section>

      <section className="stats-strip" aria-label="Contract status">
        <div className="stat">
          <span>Settled through this contract</span>
          <strong>
            {isConfigured && totalPaid !== undefined
              ? `${formatUsdc(totalPaid)} USDC`
              : "Deployment pending"}
          </strong>
        </div>
        <div className="stat">
          <span>Contract USDC balance</span>
          <strong>
            {isConfigured && contractBalance !== undefined
              ? `${formatUsdc(contractBalance)} USDC`
              : "—"}
          </strong>
        </div>
        <div className="stat">
          <span>Contract</span>
          <strong className="mono">
            {isConfigured ? shortAddress(appConfig.contract, 6) : "Not configured"}
          </strong>
        </div>
        <div className="stat">
          <span>Network</span>
          <strong>{appConfig.chain.name} / {appConfig.chainId}</strong>
        </div>
      </section>

      <section id="how-it-works" className="section">
        <div className="section-heading">
          <span className="eyebrow">One primitive, three steps</span>
          <h2>Authorization before settlement.</h2>
          <p>
            Requisition is the missing approval layer between an agent deciding to
            buy something and money leaving a buyer&apos;s wallet.
          </p>
        </div>
        <div className="flow-grid">
          <article className="card flow-card">
            <span className="step-number">01</span>
            <h3>The agent signs</h3>
            <p>
              A local CLI creates an EIP-712 request with buyer, vendor, amount,
              purpose hash, expiry, and nonce. It needs no gas and holds no funds.
            </p>
            <div className="mini-code mono">
              req create --contract 0x... --buyer 0x... --vendor 0x... --amount 0.01 --purpose &quot;API credits&quot;
            </div>
          </article>
          <article className="card flow-card">
            <span className="step-number">02</span>
            <h3>The buyer verifies</h3>
            <p>
              The buyer opens a portable link. The app checks the signature, chain,
              contract, purpose hash, expiry, and buyer before enabling payment.
            </p>
            <div className="mini-check">
              <span>Signature verified</span>
              <span>Purpose matched</span>
              <span>Buyer matched</span>
            </div>
          </article>
          <article className="card flow-card">
            <span className="step-number">03</span>
            <h3>USDC moves directly</h3>
            <p>
              One approval settles one request or a batch. USDC moves from buyer to
              vendor. The contract records the payment and never holds a balance.
            </p>
            <div className="mini-code mono">buyer → vendor / exact amount / one tx</div>
          </article>
        </div>
      </section>

      <section className="section split-section">
        <div className="section-heading">
          <span className="eyebrow">Why this exists</span>
          <h2>Agents should not need a wallet to ask for something.</h2>
        </div>
        <div className="split-copy">
          <p>
            Giving an agent a funded wallet creates a new custody problem. Asking a
            human to copy an address from chat loses the request and the approval
            trail. Requisition keeps the request machine-readable and makes the
            human approval explicit.
          </p>
          <div className="tag-row">
            <span className="tag">Not a wallet</span>
            <span className="tag">Not escrow</span>
            <span className="tag">No admin keys</span>
            <span className="tag">No fees</span>
            <span className="tag">Public receipts</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <span className="eyebrow">Built on Arc</span>
          <h2>USDC is the gas token. Settlement is the point.</h2>
        </div>
        <div className="three-grid">
          <article className="card fact-card">
            <h3>USDC-native fees</h3>
            <p>
              Arc uses USDC for gas, so the buyer does not need a separate volatile
              gas token to approve a payment.
            </p>
          </article>
          <article className="card fact-card">
            <h3>Sub-second finality</h3>
            <p>
              The receipt is available immediately. The app still waits for a real
              transaction receipt before showing success.
            </p>
          </article>
          <article className="card fact-card">
            <h3>Public evidence</h3>
            <p>
              Every paid request emits a <span className="mono">RequisitionPaid</span>{" "}
              event. Receipts can be checked against the transaction log.
            </p>
          </article>
        </div>
      </section>

      <section className="section callout">
        <div>
          <span className="eyebrow">Studio origin, mainnet evidence</span>
          <h2>Small scope. Real money. Public proof.</h2>
          <p>
            The contract and app are built through Arc Studio on testnet, then
            hardened and prepared for Arc mainnet deployment with Arc Foundry. The
            submission requires a real USDC batch, not a mockup.
          </p>
        </div>
        <div className="callout-actions">
          <Link className="button button-primary" to="/proof">
            View proof and limitations
          </Link>
          <Link className="button button-secondary" to="/docs">
            Read the EIP-712 schema
          </Link>
        </div>
      </section>
    </div>
  );
}
