import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useReadContract } from "wagmi";
import { CopyButton } from "../components/CopyButton";
import { StatusPill } from "../components/StatusPill";
import { appConfig, explorerAddress, explorerTx, isConfigured } from "../lib/config";
import { erc20Abi, requisitionBookAbi } from "../lib/contract";
import { formatUsdc, shortAddress } from "../lib/format";

type Evidence = {
  status: string;
  chainId: number;
  contract: string | null;
  exampleTx: string | null;
  studio?: {
    webUrl: string;
    previewUrl: string;
    contract: string;
    deployTx: string;
    deployBlock: number;
    chainId: number;
    tests: string;
    notes: string;
  };
  batch: {
    requestCount: number;
    totalAmount: string;
    vendors: Array<{
      address: string;
      amount: string;
      balanceBefore: string;
      balanceAfter: string;
    }>;
    contractBalanceAfter: string;
    totalPaidAfter: string;
    events: string[];
  } | null;
  verification: {
    codePresent: boolean;
    source: string;
    notes: string;
  };
};

export function Proof() {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
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

  useEffect(() => {
    let cancelled = false;
    fetch("/evidence.json")
      .then((response) => {
        if (!response.ok) throw new Error("Evidence file is not available.");
        return response.json() as Promise<Evidence>;
      })
      .then((data) => {
        if (!cancelled) setEvidence(data);
      })
      .catch((error) => {
        if (!cancelled) {
          setEvidenceError(error instanceof Error ? error.message : "Evidence unavailable.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const exampleTx = appConfig.exampleTx || evidence?.exampleTx || "";
  const evidenceStatus = evidence?.status ?? "pending";
  const evidenceBatch = evidence?.batch;

  return (
    <div className="page">
      <div className="page-heading">
        <span className="eyebrow">Live proof</span>
        <h1>Evidence, not assertions.</h1>
        <p>
          The contract address, live total, and transaction links are public. The
          mainnet batch evidence section stays explicitly pending until the real
          USDC payment has happened.
        </p>
      </div>

      <div className="proof-banner card">
        <div>
          <span className="summary-label">Evidence status</span>
          <strong className="capitalize">{evidenceStatus}</strong>
        </div>
        <StatusPill tone={evidenceStatus === "complete" ? "success" : "warning"}>
          {evidenceStatus === "complete" ? "Complete" : "Mainnet batch pending"}
        </StatusPill>
        <p>
          Required evidence is a real Arc mainnet contract and a real USDC batch
          made through this public app. Testnet and local tests are supporting
          evidence only.
        </p>
      </div>

      <div className="proof-grid">
        <section className="card proof-card">
          <h2>Contract</h2>
          <dl className="proof-meta">
            <div>
              <dt>Network</dt>
              <dd>{appConfig.chain.name} / {appConfig.chainId}</dd>
            </div>
            <div>
              <dt>Contract</dt>
              <dd className="inline-value">
                {isConfigured ? (
                  <>
                    <a href={explorerAddress(appConfig.contract)} target="_blank" rel="noreferrer" className="mono">
                      {shortAddress(appConfig.contract, 8)}
                    </a>
                    <CopyButton value={appConfig.contract} />
                  </>
                ) : (
                  "Pending deployment"
                )}
              </dd>
            </div>
            <div>
              <dt>USDC</dt>
              <dd className="mono">{appConfig.usdc}</dd>
            </div>
            <div>
              <dt>Live total paid</dt>
              <dd>{totalPaid !== undefined ? `${formatUsdc(totalPaid)} USDC` : "—"}</dd>
            </div>
            <div>
              <dt>Contract balance</dt>
              <dd>
                {contractBalance !== undefined
                  ? `${formatUsdc(contractBalance)} USDC`
                  : "—"}
                {contractBalance !== undefined && contractBalance > 0n && (
                  <span className="inline-warning"> Contract is holding funds.</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Deployment tx</dt>
              <dd>
                {appConfig.deploymentTx ? (
                  <a href={explorerTx(appConfig.deploymentTx)} target="_blank" rel="noreferrer">
                    Open deployment transaction
                  </a>
                ) : (
                  "Pending deployment"
                )}
              </dd>
            </div>
            <div>
              <dt>Example batch tx</dt>
              <dd>
                {exampleTx ? (
                  <a href={explorerTx(exampleTx)} target="_blank" rel="noreferrer">
                    Open mainnet transaction
                  </a>
                ) : (
                  "Pending real USDC batch"
                )}
              </dd>
            </div>
            <div>
              <dt>Source verification</dt>
              <dd>{evidence?.verification.source ?? "Not attempted"}</dd>
            </div>
          </dl>
        </section>

        <aside className="card proof-card">
          <h2>Project links</h2>
          <div className="link-stack">
            {appConfig.studioUrl ? (
              <a href={appConfig.studioUrl} target="_blank" rel="noreferrer">
                Arc Studio project
              </a>
            ) : (
              <span className="muted">Arc Studio URL pending</span>
            )}
            {appConfig.repoUrl ? (
              <a href={appConfig.repoUrl} target="_blank" rel="noreferrer">
                Public repository
              </a>
            ) : (
              <span className="muted">Repository URL pending</span>
            )}
            {appConfig.videoUrl ? (
              <a href={appConfig.videoUrl} target="_blank" rel="noreferrer">
                Demo video
              </a>
            ) : (
              <span className="muted">Video pending</span>
            )}
            <Link to="/docs">Security model and limitations</Link>
          </div>
          <div className="proof-note">
            Independent project. Not affiliated with Circle or Arc. Unaudited.
            Use small amounts. The contract has no admin and cannot recover USDC
            sent directly to it.
          </div>
        </aside>
      </div>

      {evidence?.studio && (
        <section className="section">
          <div className="section-heading">
            <span className="eyebrow">Arc Studio origin</span>
            <h2>Built and tested on testnet first.</h2>
            <p>
              Studio produced the contract, tests, and app on Arc Testnet. That
              artifact is supporting evidence only; the required mainnet contract
              and real USDC batch are separate and still pending.
            </p>
          </div>
          <div className="card proof-card">
            <dl className="proof-meta">
              <div>
                <dt>Studio project</dt>
                <dd>
                  <a href={evidence.studio.webUrl} target="_blank" rel="noreferrer">
                    Open Arc Studio project
                  </a>
                </dd>
              </div>
              <div>
                <dt>Testnet preview</dt>
                <dd>
                  <a href={evidence.studio.previewUrl} target="_blank" rel="noreferrer">
                    Open Studio preview
                  </a>
                </dd>
              </div>
              <div>
                <dt>Testnet contract</dt>
                <dd>
                  <a
                    href={`https://explorer.testnet.arc.io/address/${evidence.studio.contract}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mono"
                  >
                    {shortAddress(evidence.studio.contract, 8)}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Testnet deploy tx</dt>
                <dd>
                  <a
                    href={`https://explorer.testnet.arc.io/tx/${evidence.studio.deployTx}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mono"
                  >
                    {shortAddress(evidence.studio.deployTx, 8)}
                  </a>
                  <span className="muted"> block {evidence.studio.deployBlock}</span>
                </dd>
              </div>
              <div>
                <dt>Contract tests</dt>
                <dd>{evidence.studio.tests}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{evidence.studio.notes}</dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-heading">
          <span className="eyebrow">Real batch evidence</span>
          <h2>Buyer to two vendors, one atomic transaction.</h2>
          <p>
            This section is populated only after the real mainnet batch. Amounts
            are recorded in 6-decimal USDC base units and displayed as USDC.
          </p>
        </div>
        {evidenceBatch ? (
          <div className="card evidence-card">
            <div className="evidence-top">
              <div>
                <span className="summary-label">Requests</span>
                <strong>{evidenceBatch.requestCount}</strong>
              </div>
              <div>
                <span className="summary-label">Total moved</span>
                <strong>{formatUsdc(BigInt(evidenceBatch.totalAmount))} USDC</strong>
              </div>
              <div>
                <span className="summary-label">Contract after</span>
                <strong>{formatUsdc(BigInt(evidenceBatch.contractBalanceAfter))} USDC</strong>
              </div>
              <div>
                <span className="summary-label">Total paid after</span>
                <strong>{formatUsdc(BigInt(evidenceBatch.totalPaidAfter))} USDC</strong>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Amount</th>
                    <th>Balance before</th>
                    <th>Balance after</th>
                  </tr>
                </thead>
                <tbody>
                  {evidenceBatch.vendors.map((vendor) => (
                    <tr key={vendor.address}>
                      <td className="mono">{shortAddress(vendor.address, 6)}</td>
                      <td>{formatUsdc(BigInt(vendor.amount))} USDC</td>
                      <td>{formatUsdc(BigInt(vendor.balanceBefore))}</td>
                      <td>{formatUsdc(BigInt(vendor.balanceAfter))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {evidenceBatch.events.length > 0 && (
              <div className="event-links">
                <span>Event log transactions</span>
                {evidenceBatch.events.map((hash) => (
                  <a key={hash} href={explorerTx(hash)} target="_blank" rel="noreferrer">
                    {shortAddress(hash, 8)}
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="card empty-evidence">
            <strong>No mainnet batch evidence yet.</strong>
            <p>
              {evidenceError ??
                "The contract is not yet deployed with a funded buyer wallet. This page will show the real transaction, vendor deltas, and contract balance after the batch is executed."}
            </p>
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-heading">
          <span className="eyebrow">Honest limits</span>
          <h2>What this proof does not claim.</h2>
        </div>
        <div className="three-grid">
          <article className="card fact-card">
            <h3>No audit</h3>
            <p>
              The contract is small and tested locally, but it has not been
              independently audited. Use small amounts.
            </p>
          </article>
          <article className="card fact-card">
            <h3>No delivery guarantee</h3>
            <p>
              Payment proves authorization and settlement. It does not prove that a
              vendor delivered the service.
            </p>
          </article>
          <article className="card fact-card">
            <h3>No custody</h3>
            <p>
              The contract never holds USDC. Direct transfers to the contract are
              not recoverable because there is no admin or recovery function.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
