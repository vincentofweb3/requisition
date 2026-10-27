import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { parseEventLogs, zeroHash, type Hex } from "viem";
import { usePublicClient, useReadContract } from "wagmi";
import { CopyButton } from "../components/CopyButton";
import { StatusPill } from "../components/StatusPill";
import { appConfig, explorerAddress, explorerTx, isConfigured } from "../lib/config";
import { requisitionBookAbi } from "../lib/contract";
import { formatDateTime, formatUsdc, humanizeError, shortAddress } from "../lib/format";

type TxCheck = "idle" | "checking" | "verified" | "mismatch" | "error";

export function Receipt() {
  const { requestId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tx = searchParams.get("tx");
  const publicClient = usePublicClient();
  const [txCheck, setTxCheck] = useState<TxCheck>("idle");
  const [txError, setTxError] = useState<string | null>(null);
  const [txInput, setTxInput] = useState("");
  const validRequestId =
    requestId && /^0x[0-9a-fA-F]{64}$/.test(requestId)
      ? (requestId as Hex)
      : undefined;
  const validTx = tx && /^0x[0-9a-fA-F]{64}$/.test(tx) ? (tx as Hex) : undefined;

  const {
    data: record,
    isLoading,
    error: readError
  } = useReadContract({
    address: appConfig.contract,
    abi: requisitionBookAbi,
    functionName: "records",
    args: [validRequestId ?? zeroHash],
    query: {
      enabled: isConfigured && Boolean(validRequestId),
      refetchInterval: 15_000
    }
  });

  useEffect(() => {
    setTxCheck("idle");
    setTxError(null);
    if (!tx) return;
    if (!validTx) {
      setTxCheck("error");
      setTxError("Transaction hash is not a 32-byte hex value.");
      return;
    }
    if (!validRequestId) {
      setTxCheck("error");
      setTxError("Request ID is not a 32-byte hex value.");
      return;
    }
    if (!publicClient || !isConfigured) return;

    let cancelled = false;
    setTxCheck("checking");
    publicClient
      .getTransactionReceipt({ hash: validTx })
      .then((transactionReceipt) => {
        if (cancelled) return;
        const events = parseEventLogs({
          abi: requisitionBookAbi,
          eventName: "RequisitionPaid",
          logs: transactionReceipt.logs
        });
        const match = events.some(
          (event) =>
            event.address.toLowerCase() === appConfig.contract.toLowerCase() &&
            event.args.requestId.toLowerCase() === validRequestId.toLowerCase()
        );
        setTxCheck(match ? "verified" : "mismatch");
        if (!match) {
          setTxError(
            "The transaction receipt does not contain a matching RequisitionPaid event from this contract."
          );
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setTxCheck("error");
        setTxError(humanizeError(error));
      });
    return () => {
      cancelled = true;
    };
  }, [tx, validTx, validRequestId, publicClient]);

  if (!isConfigured) {
    return (
      <div className="page">
        <div className="page-heading">
          <span className="eyebrow">Public receipt</span>
          <h1>Receipt unavailable.</h1>
          <p>The contract address is not configured in this build.</p>
        </div>
        <div className="notice notice-warning">
          Onchain receipts activate after a contract address is configured.
        </div>
      </div>
    );
  }

  if (!validRequestId) {
    return (
      <div className="page">
        <div className="page-heading">
          <span className="eyebrow">Public receipt</span>
          <h1>Invalid request ID.</h1>
          <p>A receipt URL needs a 32-byte request ID.</p>
        </div>
        <Link className="button button-secondary" to="/desk">
          Back to the desk
        </Link>
      </div>
    );
  }

  const paid = Boolean(record && record[6] > 0n);

  return (
    <div className="page">
      <div className="page-heading">
        <span className="eyebrow">Public receipt</span>
        <h1>{paid ? "Payment recorded." : "Request not paid."}</h1>
        <p>
          This page reads the contract record directly. The human-readable purpose
          stays offchain; the purpose hash is what the agent signed.
        </p>
      </div>

      <div className="receipt-grid">
        <section className="card receipt-card">
          <div className="receipt-top">
            <StatusPill tone={paid ? "success" : "warning"}>
              {paid ? "Paid onchain" : "Unpaid"}
            </StatusPill>
            <CopyButton value={validRequestId} label="Copy request ID" />
          </div>
          {isLoading && <p>Reading the contract...</p>}
          {readError && <p className="notice notice-danger">{humanizeError(readError)}</p>}
          {!isLoading && !paid && (
            <p className="notice notice-warning">
              No payment exists for this request. It may be unpaid, expired, or
              never submitted.
            </p>
          )}
          {record && paid && (
            <>
              <div className="receipt-hero-amount">
                {formatUsdc(record[3])} USDC
              </div>
              <dl className="receipt-meta">
                <div>
                  <dt>Agent</dt>
                  <dd className="mono" title={record[0]}>
                    {shortAddress(record[0], 6)}
                  </dd>
                </div>
                <div>
                  <dt>Buyer</dt>
                  <dd className="mono" title={record[1]}>
                    {shortAddress(record[1], 6)}
                  </dd>
                </div>
                <div>
                  <dt>Vendor</dt>
                  <dd className="mono" title={record[2]}>
                    {shortAddress(record[2], 6)}
                  </dd>
                </div>
                <div>
                  <dt>Paid</dt>
                  <dd>{formatDateTime(record[6])}</dd>
                </div>
                <div>
                  <dt>Expiry</dt>
                  <dd>{formatDateTime(record[5])}</dd>
                </div>
                <div>
                  <dt>Purpose hash</dt>
                  <dd className="mono break-all" title={record[4]}>
                    {record[4]}
                  </dd>
                </div>
                <div>
                  <dt>Nonce</dt>
                  <dd className="mono break-all" title={record[7]}>
                    {record[7]}
                  </dd>
                </div>
                <div>
                  <dt>Contract</dt>
                  <dd>
                    <a href={explorerAddress(appConfig.contract)} target="_blank" rel="noreferrer">
                      {shortAddress(appConfig.contract, 6)}
                    </a>
                  </dd>
                </div>
              </dl>
            </>
          )}
        </section>

        <aside className="card receipt-side">
          <h2>Transaction check</h2>
          {!tx && (
            <>
              <p>
                Add a transaction hash to verify that this contract emitted the
                matching <span className="mono">RequisitionPaid</span> event.
              </p>
              <label className="field">
                <span>Transaction hash</span>
                <input
                  className="input"
                  value={txInput}
                  onChange={(event) => setTxInput(event.target.value)}
                  placeholder="0x..."
                  spellCheck={false}
                />
              </label>
              <button
                className="button button-secondary"
                type="button"
                disabled={!validTx && !/^0x[0-9a-fA-F]{64}$/.test(txInput.trim())}
                onClick={() =>
                  setSearchParams({ tx: txInput.trim() }, { replace: true })
                }
              >
                Verify transaction
              </button>
            </>
          )}
          {tx && (
            <>
              <p className="mono break-all">{tx}</p>
              {txCheck === "checking" && <p>Checking the receipt...</p>}
              {txCheck === "verified" && (
                <div className="notice notice-success">
                  Transaction verified against receipt. The contract emitted the
                  matching event.
                </div>
              )}
              {txCheck === "mismatch" && (
                <div className="notice notice-danger">{txError}</div>
              )}
              {txCheck === "error" && (
                <div className="notice notice-danger">{txError}</div>
              )}
              <a
                className="button button-secondary"
                href={explorerTx(tx)}
                target="_blank"
                rel="noreferrer"
              >
                Open transaction
              </a>
              <button
                className="button button-ghost button-small"
                type="button"
                onClick={() => setSearchParams({}, { replace: true })}
              >
                Clear transaction
              </button>
            </>
          )}
          <div className="receipt-note">
            A receipt without a transaction hash still shows the contract record.
            It does not prove which transaction produced it.
          </div>
          <Link className="button button-ghost button-small" to="/desk">
            Back to the desk
          </Link>
        </aside>
      </div>
    </div>
  );
}
