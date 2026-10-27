import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { isHex, parseEventLogs, type Hex } from 'viem'
import { Check, CircleAlert } from 'lucide-react'
import { AddressChip, Card, ExternalAnchor, Field, Notice, PageTitle } from '@/components/ui'
import { BOOK_ADDRESS, txUrl } from '@/lib/env'
import { formatDateTime, shortHash, usdc } from '@/lib/format'
import { CHAIN_ID, hashPurpose, requisitionBookAbi } from '@/lib/requisition'

const isBytes32 = (value: string | null | undefined): value is Hex => Boolean(value && isHex(value, { strict: true }) && value.length === 66)

function Row({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-label="Passed" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-label="Failed" />}
      <span>{children}</span>
    </li>
  )
}

export default function Receipt() {
  const { requestId } = useParams()
  const [search] = useSearchParams()
  const client = usePublicClient({ chainId: CHAIN_ID })
  const txParam = search.get('tx')
  const idValid = isBytes32(requestId)
  const txValid = isBytes32(txParam)
  const [purposeText, setPurposeText] = useState('')

  const record = useQuery({
    queryKey: ['receipt-record', requestId],
    enabled: Boolean(idValid && client && BOOK_ADDRESS),
    queryFn: async () => {
      if (!client || !BOOK_ADDRESS || !idValid) throw new Error('Not ready')
      const [used, tuple] = await Promise.all([
        client.readContract({ address: BOOK_ADDRESS, abi: requisitionBookAbi, functionName: 'used', args: [requestId] }),
        client.readContract({ address: BOOK_ADDRESS, abi: requisitionBookAbi, functionName: 'records', args: [requestId] }),
      ])
      const [agent, buyer, vendor, amount, purposeHash, expiresAt, paidAt, nonce] = tuple
      return { used, agent, buyer, vendor, amount, purposeHash, expiresAt, paidAt, nonce }
    },
  })

  const tx = useQuery({
    queryKey: ['receipt-tx', txParam, requestId],
    enabled: Boolean(idValid && txValid && client && BOOK_ADDRESS),
    retry: 1,
    queryFn: async () => {
      if (!client || !BOOK_ADDRESS || !txValid || !idValid) throw new Error('Not ready')
      const receipt = await client.getTransactionReceipt({ hash: txParam })
      const logs = parseEventLogs({ abi: requisitionBookAbi, eventName: 'RequisitionPaid', logs: receipt.logs })
      const book = BOOK_ADDRESS
      const match = logs.find((log) => log.address.toLowerCase() === book.toLowerCase() && log.args.requestId.toLowerCase() === requestId.toLowerCase())
      return { status: receipt.status, blockNumber: receipt.blockNumber, log: match }
    },
  })

  if (!BOOK_ADDRESS) {
    return (
      <div>
        <PageTitle title="Receipt" />
        <Notice tone="bad">This app has no RequisitionBook address configured.</Notice>
      </div>
    )
  }
  if (!idValid) {
    return (
      <div>
        <PageTitle title="Receipt" />
        <Notice tone="bad" title="Invalid request id">
          A request id is a 32-byte hex value starting with 0x.
        </Notice>
      </div>
    )
  }

  const r = record.data
  const paid = r?.used === true
  const log = tx.data?.log
  const purposeMatches = purposeText.length > 0 && r && hashPurpose(purposeText) === r.purposeHash

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle eyebrow="Receipt" title={record.isLoading ? 'Checking…' : paid ? 'Payment recorded' : 'Not paid'}>
        Read directly from the RequisitionBook contract on Arc Testnet.
      </PageTitle>

      <p className="mono mb-4 break-all text-xs text-muted">{requestId}</p>

      {record.error && (
        <Notice tone="bad" title="Could not read the contract">
          {record.error instanceof Error ? record.error.message.split('\n')[0] : 'Unknown error.'}
        </Notice>
      )}

      {record.isSuccess && !paid && (
        <Notice tone="caution" title="No payment found">
          The contract has no record for this request id. It may be unpaid, or the id may be wrong.
        </Notice>
      )}

      {r && paid && (
        <Card>
          <p className="display num text-5xl font-semibold">
            {usdc(r.amount)} <span className="text-xl font-medium text-muted">USDC</span>
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field label="Buyer (paid)">
              <AddressChip address={r.buyer} />
            </Field>
            <Field label="Vendor (received)">
              <AddressChip address={r.vendor} />
            </Field>
            <Field label="Agent (signed)">
              <AddressChip address={r.agent} />
            </Field>
            <Field label="Paid at">
              <span className="num">{formatDateTime(r.paidAt)}</span>
            </Field>
            <Field label="Request expiry">
              <span className="num">{formatDateTime(r.expiresAt)}</span>
            </Field>
            <Field label="Purpose hash">
              <span className="mono break-all text-[13px]">{r.purposeHash}</span>
            </Field>
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <label htmlFor="purpose-check" className="label-caps">
              Check a purpose text against this hash
            </label>
            <input
              id="purpose-check"
              value={purposeText}
              onChange={(e) => setPurposeText(e.target.value)}
              placeholder="Paste the purpose text"
              className="mt-2 min-h-11 w-full rounded-2xl border border-line bg-surface-muted px-3 text-sm"
            />
            {purposeText && (
              <p className={`mt-2 text-sm ${purposeMatches ? 'text-ok' : 'text-bad'}`}>
                {purposeMatches ? 'This text matches the recorded purpose hash.' : 'This text does not match the recorded purpose hash.'}
              </p>
            )}
          </div>
        </Card>
      )}

      {txValid && (
        <Card className="mt-4">
          <h2 className="display text-xl font-semibold">Transaction check</h2>
          <p className="mt-1 text-sm">
            <ExternalAnchor href={txUrl(txParam)}>
              <span className="mono">{shortHash(txParam)}</span>
            </ExternalAnchor>
          </p>
          {tx.isLoading && <p className="mt-3 text-sm text-muted">Fetching the transaction receipt…</p>}
          {tx.error && (
            <div className="mt-3">
              <Notice tone="bad" title="Receipt not found">
                The RPC has no receipt for this transaction hash. It may be pending, or from another network.
              </Notice>
            </div>
          )}
          {tx.data && (
            <ul className="mt-3 space-y-2">
              <Row ok={tx.data.status === 'success'}>
                Transaction {tx.data.status === 'success' ? 'succeeded' : 'reverted'} in block <span className="num">{tx.data.blockNumber.toString()}</span>
              </Row>
              <Row ok={Boolean(log)}>
                {log ? 'A RequisitionPaid log from this contract carries this request id.' : 'No RequisitionPaid log for this request id was emitted by this contract in this transaction.'}
              </Row>
              {log && r && (
                <Row ok={log.args.amount === r.amount && log.args.buyer.toLowerCase() === r.buyer.toLowerCase() && log.args.vendor.toLowerCase() === r.vendor.toLowerCase()}>
                  Log amount, buyer and vendor match the contract record.
                </Row>
              )}
            </ul>
          )}
        </Card>
      )}

      {!txValid && txParam && (
        <div className="mt-4">
          <Notice tone="caution">The tx parameter is not a valid transaction hash, so it was ignored.</Notice>
        </div>
      )}
    </div>
  )
}
