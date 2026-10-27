import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWriteContract
} from "wagmi";
import { CopyButton } from "../components/CopyButton";
import { StatusPill } from "../components/StatusPill";
import { bundleJson, bundleLink, decodeBundle, encodeBundle, readBundleFromLocation } from "../lib/bundle";
import { appConfig, arc, explorerTx, isConfigured } from "../lib/config";
import { erc20Abi, requisitionBookAbi } from "../lib/contract";
import { formatDateTime, formatUsdc, humanizeError, shortAddress } from "../lib/format";
import {
  isExpired,
  messageFor,
  requestIdFor,
  validateBundleShape,
  verifyItem,
  type Bundle,
  type Verification
} from "../lib/requisition";

type Phase = "idle" | "approving" | "paying" | "success";

export function Desk() {
  const location = useLocation();
  const navigate = useNavigate();
  const { address, chain, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [verifications, setVerifications] = useState<Record<string, Verification>>({});
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [deselected, setDeselected] = useState<Record<string, boolean>>({});
  const [phase, setPhase] = useState<Phase>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paidRows, setPaidRows] = useState<Array<{ id: string; index: number }>>([]);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    try {
      const parsed = readBundleFromLocation(location.search, location.hash);
      setBundle(parsed);
      setBundleError(null);
      setPhase("idle");
      setTxHash(null);
      setPaymentError(null);
      setPaidRows([]);
      setDeselected({});
    } catch (error) {
      setBundle(null);
      setBundleError(error instanceof Error ? error.message : "Invalid bundle.");
    }
  }, [location.search, location.hash]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      30_000
    );
    return () => window.clearInterval(timer);
  }, []);

  const requestIds = useMemo(
    () => (bundle ? bundle.requests.map((item) => requestIdFor(item, bundle)) : []),
    [bundle]
  );

  useEffect(() => {
    if (!bundle) {
      setVerifications({});
      setVerificationError(null);
      return;
    }
    let cancelled = false;
    setVerificationError(null);
    Promise.all(
      bundle.requests.map(async (item) => {
        const result = await verifyItem(item, bundle);
        return [result.requestId, result] as const;
      })
    )
      .then((entries) => {
        if (!cancelled) setVerifications(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) setVerificationError("Signatures could not be verified.");
      });
    return () => {
      cancelled = true;
    };
  }, [bundle]);

  const usedContracts = requestIds.map((id) => ({
    address: appConfig.contract,
    abi: requisitionBookAbi,
    functionName: "used" as const,
    args: [id] as const
  }));
  const recordContracts = requestIds.map((id) => ({
    address: appConfig.contract,
    abi: requisitionBookAbi,
    functionName: "records" as const,
    args: [id] as const
  }));

  const {
    data: usedData,
    refetch: refetchUsed
  } = useReadContracts({
    contracts: usedContracts,
    query: { enabled: isConfigured && requestIds.length > 0 }
  });
  const {
    data: recordData,
    refetch: refetchRecords
  } = useReadContracts({
    contracts: recordContracts,
    query: { enabled: isConfigured && requestIds.length > 0 }
  });
  const {
    data: allowance,
    refetch: refetchAllowance
  } = useReadContract({
    address: appConfig.usdc,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address ?? appConfig.contract, appConfig.contract],
    query: { enabled: Boolean(address) && isConfigured }
  });
  const {
    data: balance,
    refetch: refetchBalance
  } = useReadContract({
    address: appConfig.usdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address ?? appConfig.contract],
    query: { enabled: Boolean(address) && isConfigured }
  });

  const rows = useMemo(() => {
    if (!bundle) return [];
    return bundle.requests.map((item, index) => {
      const id = requestIds[index];
      const verification = verifications[id];
      const usedEntry = usedData?.[index];
      const recordEntry = recordData?.[index];
      const used = usedEntry?.status === "success" ? usedEntry.result : undefined;
      const record =
        recordEntry?.status === "success" ? recordEntry.result : undefined;
      const paidAt = record?.[6] ?? 0n;
      const expired = isExpired(item, now);
      const paid = used === true || paidAt > 0n;
      const ready = verification?.ok === true && !paid && !expired;
      return {
        item,
        id,
        index,
        verification,
        used,
        record,
        paidAt,
        expired,
        paid,
        ready
      };
    });
  }, [bundle, requestIds, verifications, usedData, recordData, now]);

  const selectedRows = rows.filter((row) => row.ready && !deselected[row.id]);
  const total = selectedRows.reduce(
    (sum, row) => sum + BigInt(row.item.request.amount),
    0n
  );
  const bundleBuyer = bundle?.requests[0]?.request.buyer;
  const buyerMatches =
    Boolean(address) &&
    Boolean(bundleBuyer) &&
    bundleBuyer!.toLowerCase() === address!.toLowerCase();
  const bundleMatchesConfig =
    Boolean(bundle) &&
    bundle!.chainId === appConfig.chainId &&
    bundle!.contract.toLowerCase() === appConfig.contract.toLowerCase();
  const canPay =
    isConfigured &&
    bundleMatchesConfig &&
    buyerMatches &&
    chain?.id === arc.id &&
    selectedRows.length > 0 &&
    phase !== "approving" &&
    phase !== "paying" &&
    phase !== "success";

  function toggleRow(id: string) {
    setDeselected((current) => ({ ...current, [id]: !current[id] }));
  }

  async function refresh() {
    await Promise.all([
      refetchUsed(),
      refetchRecords(),
      refetchAllowance(),
      refetchBalance()
    ]);
  }

  async function handlePay() {
    setPaymentError(null);
    setTxHash(null);
    if (!bundle || !address || !publicClient) {
      setPaymentError("Connect the buyer wallet and retry.");
      return;
    }
    if (chain?.id !== arc.id) {
      setPaymentError(`Switch the wallet to ${arc.name}.`);
      return;
    }
    if (!buyerMatches) {
      setPaymentError("The connected wallet is not the buyer in this bundle.");
      return;
    }
    if (selectedRows.length === 0) {
      setPaymentError("Select at least one valid request.");
      return;
    }

    try {
      setPaidRows(selectedRows.map((row) => ({ id: row.id, index: row.index })));
      if ((allowance ?? 0n) < total) {
        setPhase("approving");
        const approveHash = await writeContractAsync({
          address: appConfig.usdc,
          abi: erc20Abi,
          functionName: "approve",
          args: [appConfig.contract, total]
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      setPhase("paying");
      let hash: `0x${string}`;
      if (selectedRows.length === 1) {
        const row = selectedRows[0];
        hash = await writeContractAsync({
          address: appConfig.contract,
          abi: requisitionBookAbi,
          functionName: "pay",
          args: [messageFor(row.item.request), row.item.signature]
        });
      } else {
        hash = await writeContractAsync({
          address: appConfig.contract,
          abi: requisitionBookAbi,
          functionName: "payBatch",
          args: [
            selectedRows.map((row) => messageFor(row.item.request)),
            selectedRows.map((row) => row.item.signature)
          ]
        });
      }
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Transaction reverted.");
      setTxHash(hash);
      setPhase("success");
      await refresh();
    } catch (error) {
      setPaymentError(humanizeError(error));
      setPhase("idle");
    }
  }

  if (!bundle) {
    return (
      <div className="page">
        <div className="page-heading">
          <span className="eyebrow">Buyer desk</span>
          <h1>Open a requisition bundle.</h1>
          <p>
            Paste the bundle JSON, load the file your agent produced, or open the
            link from the agent. Payment stays disabled until every signature and
            the purpose hash verify locally.
          </p>
        </div>
        {bundleError && <div className="notice notice-danger">{bundleError}</div>}
        <BundleLoader
          onLoad={(loaded) => {
            navigate(`/desk#b=${encodeBundle(loaded)}`, { replace: true });
          }}
        />
        <div className="notice notice-info">
          Bundle links place the request in the URL fragment, so it is not sent to
          the host. The purpose text is still visible to anyone with the link; do
          not put secrets in it.
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-heading desk-heading">
        <div>
          <span className="eyebrow">Buyer desk</span>
          <h1>Review, then settle.</h1>
          <p>
            {bundle.agentLabel ? `Signed by ${bundle.agentLabel}.` : "Agent-signed bundle."}{" "}
            The contract is the final verifier; this page verifies before asking
            your wallet to approve anything.
          </p>
        </div>
        <div className="heading-actions">
          <CopyButton value={bundleLink(window.location.origin, bundle)} label="Copy bundle link" />
          <button
            className="button button-ghost button-small"
            type="button"
            onClick={() => {
              const blob = new Blob([bundleJson(bundle)], {
                type: "application/json"
              });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = "requisition-bundle.json";
              anchor.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download JSON
          </button>
        </div>
      </div>

      {!isConfigured && (
        <div className="notice notice-warning">
          The contract address is not configured in this build. You can review the
          bundle, but payment is disabled until a contract address is set.
        </div>
      )}
      {isConfigured && !bundleMatchesConfig && (
        <div className="notice notice-danger">
          This bundle targets chain {bundle.chainId} and contract{" "}
          {shortAddress(bundle.contract, 6)}. This app is configured for chain{" "}
          {appConfig.chainId} and contract {shortAddress(appConfig.contract, 6)}.
        </div>
      )}
      {verificationError && (
        <div className="notice notice-danger">{verificationError}</div>
      )}

      <div className="desk-grid">
        <section className="desk-main" aria-label="Requests">
          <div className="bundle-summary card">
            <div>
              <span className="summary-label">Bundle</span>
              <strong>
                {bundle.requests.length} request
                {bundle.requests.length === 1 ? "" : "s"}
              </strong>
            </div>
            <div>
              <span className="summary-label">Buyer</span>
              <strong className="mono">{shortAddress(bundleBuyer ?? "", 6)}</strong>
            </div>
            <div>
              <span className="summary-label">Created</span>
              <strong>{bundle.createdAt}</strong>
            </div>
            <div>
              <span className="summary-label">Network</span>
              <strong>{bundle.chainId === 5042 ? "Arc mainnet" : `Chain ${bundle.chainId}`}</strong>
            </div>
          </div>

          <div className="request-list">
            {rows.map((row) => {
              const item = row.item;
              const isSelected = row.ready && !deselected[row.id];
              const status = row.paid
                ? { tone: "success" as const, label: "Paid" }
                : row.expired
                  ? { tone: "warning" as const, label: "Expired" }
                  : row.verification?.ok === false
                    ? { tone: "danger" as const, label: "Invalid" }
                    : row.verification?.ok === true
                      ? { tone: "neutral" as const, label: "Ready" }
                      : { tone: "neutral" as const, label: "Verifying" };
              return (
                <article
                  className={`request-card card ${row.ready ? "" : "request-disabled"} ${
                    isSelected ? "request-selected" : ""
                  }`}
                  key={row.id}
                >
                  <div className="request-top">
                    <label className="request-check">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!row.ready}
                        onChange={() => toggleRow(row.id)}
                      />
                      <span>Request {row.index + 1}</span>
                    </label>
                    <StatusPill tone={status.tone}>{status.label}</StatusPill>
                  </div>
                  <h2>{item.purpose}</h2>
                  <div className="request-amount">
                    {formatUsdc(BigInt(item.request.amount))} USDC
                  </div>
                  <dl className="request-meta">
                    <div>
                      <dt>Agent</dt>
                      <dd className="mono" title={item.request.agent}>
                        {shortAddress(item.request.agent, 6)}
                      </dd>
                    </div>
                    <div>
                      <dt>Vendor</dt>
                      <dd>
                        {item.vendorLabel && <span>{item.vendorLabel} </span>}
                        <span className="mono" title={item.request.vendor}>
                          {shortAddress(item.request.vendor, 6)}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Expires</dt>
                      <dd>{formatDateTime(BigInt(item.request.expiresAt))}</dd>
                    </div>
                    <div>
                      <dt>Request ID</dt>
                      <dd className="mono" title={row.id}>
                        {shortAddress(row.id, 6)}
                      </dd>
                    </div>
                  </dl>
                  {row.verification?.error && (
                    <p className="inline-error">{row.verification.error}</p>
                  )}
                  {row.paid && (
                    <p className="inline-note">
                      Paid {row.paidAt > 0n ? formatDateTime(row.paidAt) : "onchain"}.{" "}
                      <a href={`/r/${row.id}${txHash ? `?tx=${txHash}` : ""}`}>
                        Open receipt
                      </a>
                    </p>
                  )}
                  {row.expired && !row.paid && (
                    <p className="inline-note">This request can no longer be paid.</p>
                  )}
                  {!row.verification && (
                    <p className="inline-note">Checking the agent signature...</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <aside className="pay-panel card" aria-label="Payment summary">
          <div className="pay-panel-head">
            <span className="eyebrow">Settlement</span>
            <h2>One approval, exact total.</h2>
          </div>
          <div className="pay-line">
            <span>Selected</span>
            <strong>
              {selectedRows.length} request{selectedRows.length === 1 ? "" : "s"}
            </strong>
          </div>
          <div className="pay-line pay-total">
            <span>Total</span>
            <strong>{formatUsdc(total)} USDC</strong>
          </div>
          <div className="pay-line">
            <span>Wallet balance</span>
            <strong>{balance !== undefined ? `${formatUsdc(balance)} USDC` : "—"}</strong>
          </div>
          <div className="pay-line">
            <span>Allowance</span>
            <strong>
              {allowance !== undefined ? `${formatUsdc(allowance)} USDC` : "—"}
            </strong>
          </div>
          {!isConnected && (
            <p className="pay-hint">Connect the buyer wallet in the header.</p>
          )}
          {isConnected && !buyerMatches && (
            <p className="notice notice-warning">
              The connected wallet is not the named buyer. Only the buyer can pay
              this bundle.
            </p>
          )}
          {isConnected && chain?.id !== arc.id && (
            <p className="notice notice-warning">
              Switch the wallet to {arc.name} before paying.
            </p>
          )}
          {paymentError && <p className="notice notice-danger">{paymentError}</p>}
          {txHash && (
            <div className="notice notice-success">
              <strong>Batch settled.</strong>
              <div className="mono break-all">{shortAddress(txHash, 8)}</div>
              <a href={explorerTx(txHash)} target="_blank" rel="noreferrer">
                Open transaction on the explorer
              </a>
              <div className="receipt-links">
                {paidRows.map((row) => (
                  <a key={row.id} href={`/r/${row.id}?tx=${txHash}`}>
                    Receipt {row.index + 1}
                  </a>
                ))}
              </div>
            </div>
          )}
          <button
            className="button button-primary pay-button"
            type="button"
            disabled={!canPay}
            onClick={handlePay}
          >
            {phase === "approving"
              ? "Approving USDC..."
              : phase === "paying"
                ? "Waiting for receipt..."
                : phase === "success"
                  ? "Paid"
                  : "Approve & pay"}
          </button>
          <p className="pay-footnote">
            Approval is exact, not infinite. If allowance is short, the app asks
            for the total once, waits for the approval receipt, then calls the
            contract.
          </p>
          {selectedRows.length > 1 && (
            <p className="pay-footnote">
              Batch settlement is atomic: one bad request reverts every transfer.
              The contract never holds USDC.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function BundleLoader({ onLoad }: { onLoad: (bundle: Bundle) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function loadText(text: string) {
    try {
      const trimmed = text.trim();
      const parsed = trimmed.startsWith("{")
        ? validateBundleShape(JSON.parse(trimmed))
        : decodeBundle(trimmed);
      setError(null);
      onLoad(parsed);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Invalid bundle.");
    }
  }

  return (
    <div className="loader-grid">
      <div className="card loader-card">
        <h2>Paste bundle JSON</h2>
        <textarea
          className="input textarea"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder='{"v":1,"chainId":5042,"contract":"0x...","requests":[...]}'
          spellCheck={false}
        />
        <button
          className="button button-primary"
          type="button"
          disabled={value.trim().length === 0}
          onClick={() => loadText(value)}
        >
          Review bundle
        </button>
        {error && <p className="notice notice-danger">{error}</p>}
      </div>
      <div className="card loader-card">
        <h2>Load a file</h2>
        <p>
          Select the JSON file produced by the agent CLI. Nothing is uploaded; the
          file is parsed in this browser.
        </p>
        <label className="file-drop">
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              file
                .text()
                .then(loadText)
                .catch(() => setError("Could not read that file."));
            }}
          />
          <span>Choose a bundle file</span>
        </label>
        <div className="loader-note">
          Or open a link ending in <span className="mono">/desk#b=...</span>.
        </div>
      </div>
    </div>
  );
}
