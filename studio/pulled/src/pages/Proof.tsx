import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { erc20Abi } from 'viem'
import { Check, CircleAlert } from 'lucide-react'
import { AddressChip, Card, CopyButton, ExternalAnchor, Notice, PageTitle } from '@/components/ui'
import { usePaymentLogs } from '@/hooks/usePaymentLogs'
import { BOOK_ADDRESS, CHAIN, DEPLOY_BLOCK, DEPLOY_TX, STUDIO_WEB_URL, USDC_ADDRESS, addressUrl, txUrl } from '@/lib/env'
import { shortHash, usdc } from '@/lib/format'
import { CHAIN_ID, requisitionBookAbi } from '@/lib/requisition'
import { getShareBase } from '@/lib/share'

function Status({ ok, children }: { ok: boolean | undefined; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok === undefined ? (
        <span className="mt-1 size-3 shrink-0 rounded-full bg-surface-muted" aria-label="Checking" />
      ) : ok ? (
        <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-label="Passed" />
      ) : (
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-label="Failed" />
      )}
      <span>{children}</span>
    </li>
  )
}

const LIMITATIONS = [
  'Testnet only. This deployment is on Arc Testnet and no mainnet deployment exists.',
  'No third-party security audit has been performed. Do not treat this as audited software.',
  'The contract is immutable and has no admin. A bug cannot be patched and there is no pause, refund, cancel or rescue.',
  'A signed request cannot be revoked onchain. It stays payable by its buyer until it expires, so use short expiries.',
  'USDC is a centrally issued token. If its issuer blocklists the buyer or a vendor, the transfer, and any batch containing it, reverts.',
  'A batch is all-or-nothing. One expired, paid or invalid request reverts the whole batch.',
  'Anyone who holds the signed bundle can read it, but only the named buyer can pay it.',
  'Bundles carry signatures, not secrets, but treat links as private: they reveal the vendor, amount and purpose.',
  'There is no backend, so the Desk depends on the public Arc Testnet RPC being reachable and may be rate limited.',
]

export default function Proof() {
  const client = usePublicClient({ chainId: CHAIN_ID })
  const [studioUrl, setStudioUrl] = useState<string>()
  useEffect(() => {
    void getShareBase().then(setStudioUrl)
  }, [])

  const chain = useQuery({
    queryKey: ['proof-chain', BOOK_ADDRESS],
    enabled: Boolean(client && BOOK_ADDRESS),
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!client || !BOOK_ADDRESS) throw new Error('Not ready')
      const [code, totalPaid, configuredUsdc, maxBatch, balance, deployReceipt] = await Promise.all([
        client.getCode({ address: BOOK_ADDRESS }),
        client.readContract({ address: BOOK_ADDRESS, abi: requisitionBookAbi, functionName: 'totalPaid' }),
        client.readContract({ address: BOOK_ADDRESS, abi: requisitionBookAbi, functionName: 'usdc' }),
        client.readContract({ address: BOOK_ADDRESS, abi: requisitionBookAbi, functionName: 'MAX_BATCH' }),
        client.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [BOOK_ADDRESS] }),
        DEPLOY_TX ? client.getTransactionReceipt({ hash: DEPLOY_TX }) : Promise.resolve(undefined),
      ])
      return { hasCode: Boolean(code && code !== '0x'), totalPaid, configuredUsdc, maxBatch, balance, deployReceipt }
    },
  })
  const scan = usePaymentLogs()

  if (!BOOK_ADDRESS) {
    return (
      <div>
        <PageTitle title="Proof" />
        <Notice tone="bad">This app has no RequisitionBook address configured.</Notice>
      </div>
    )
  }

  const c = chain.data
  const sum = scan.data?.logs.reduce((s, l) => s + l.amount, 0n)

  return (
    <div className="space-y-6">
      <PageTitle eyebrow="Proof" title="What is live onchain">
        Everything on this page is read from Arc Testnet when you open it. Nothing is hard-coded or simulated.
      </PageTitle>

      <Card>
        <h2 className="display text-xl font-semibold">Deployment</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="label-caps">RequisitionBook</dt>
            <dd className="mt-1">
              <AddressChip address={BOOK_ADDRESS} full />
            </dd>
          </div>
          <div>
            <dt className="label-caps">USDC (ERC-20, 6 decimals)</dt>
            <dd className="mt-1">
              <AddressChip address={USDC_ADDRESS} full />
            </dd>
          </div>
          <div>
            <dt className="label-caps">Chain</dt>
            <dd className="mt-1">
              {CHAIN.name} · id <span className="num">{CHAIN.chainId}</span> ·{' '}
              <ExternalAnchor href={CHAIN.explorerBase}>Explorer</ExternalAnchor>
            </dd>
          </div>
          <div>
            <dt className="label-caps">Deployment transaction</dt>
            <dd className="mt-1">
              {DEPLOY_TX ? (
                <ExternalAnchor href={txUrl(DEPLOY_TX)}>
                  <span className="mono">{shortHash(DEPLOY_TX)}</span>
                </ExternalAnchor>
              ) : (
                <span className="text-muted">Not recorded</span>
              )}
              {DEPLOY_BLOCK !== undefined && <span className="num text-muted"> · block {DEPLOY_BLOCK.toString()}</span>}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="label-caps">Studio URL</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-1">
              {STUDIO_WEB_URL ? (
                <ExternalAnchor href={STUDIO_WEB_URL}>{STUDIO_WEB_URL}</ExternalAnchor>
              ) : studioUrl ? (
                <>
                  <span className="mono break-all text-[13px]">{studioUrl}</span>
                  <CopyButton value={studioUrl} label="Copy URL" />
                </>
              ) : (
                <span className="text-muted">Resolving…</span>
              )}
            </dd>
            {!STUDIO_WEB_URL && (
              <dd className="mt-1 text-xs text-muted">
                Placeholder: this is the address the app is served from right now. Set VITE_STUDIO_WEB_URL to the public Studio URL after publishing.
              </dd>
            )}
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="display text-xl font-semibold">Live checks</h2>
        {chain.error && (
          <div className="mt-3">
            <Notice tone="bad" title="Could not read Arc Testnet">
              {chain.error instanceof Error ? chain.error.message.split('\n')[0] : 'Unknown error.'}
            </Notice>
          </div>
        )}
        <ul className="mt-4 space-y-2.5">
          <Status ok={c ? c.hasCode : undefined}>Contract code exists at the address above.</Status>
          <Status ok={c ? c.deployReceipt?.status === 'success' : undefined}>
            Deployment transaction succeeded{c?.deployReceipt ? ` in block ${c.deployReceipt.blockNumber.toString()}` : ''}.
          </Status>
          <Status ok={c ? c.configuredUsdc.toLowerCase() === USDC_ADDRESS.toLowerCase() : undefined}>
            The contract’s immutable USDC is the Arc Testnet USDC address.
          </Status>
          <Status ok={c ? c.maxBatch === 50n : undefined}>Batch cap is 50.</Status>
          <Status ok={c ? c.balance === 0n : undefined}>
            Contract USDC balance is{' '}
            <span className="num font-semibold">{c ? `${usdc(c.balance)} USDC` : '…'}</span>. It never takes custody.
          </Status>
        </ul>
        <div className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
          <div>
            <p className="label-caps">Total paid through the contract</p>
            <p className="display num mt-1 text-4xl font-semibold">
              {c ? usdc(c.totalPaid) : '…'} <span className="text-lg font-medium text-muted">USDC</span>
            </p>
          </div>
          <div>
            <p className="label-caps">Payments in the event log</p>
            <p className="display num mt-1 text-4xl font-semibold">{scan.data ? scan.data.logs.length : '…'}</p>
          </div>
        </div>
        {c && scan.data?.complete && sum !== undefined && (
          <div className="mt-4">
            <Notice tone={sum === c.totalPaid ? 'ok' : 'caution'}>
              {sum === c.totalPaid
                ? 'The sum of every RequisitionPaid event equals totalPaid.'
                : 'Event sum and totalPaid differ. A payment may have landed after the logs were read; the page refreshes every 30 seconds.'}
            </Notice>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="display text-xl font-semibold">Testnet evidence</h2>
        {scan.isLoading && <p className="mt-3 text-sm text-muted">Scanning event logs from the deployment block…</p>}
        {scan.error && (
          <div className="mt-3">
            <Notice tone="bad" title="Could not read event logs">
              {scan.error instanceof Error ? scan.error.message.split('\n')[0] : 'Unknown error.'}
            </Notice>
          </div>
        )}
        {scan.data && (
          <>
            <p className="mt-2 text-sm text-muted">
              Scanned blocks <span className="num">{scan.data.fromBlock.toString()}</span> to{' '}
              <span className="num">{scan.data.head.toString()}</span>.{' '}
              {scan.data.complete
                ? 'This covers every block since deployment.'
                : 'This is a recent window only; earlier payments exist in the explorer.'}
            </p>
            {scan.data.logs.length === 0 ? (
              <div className="mt-4">
                <Notice>No payment has been made through this deployment yet. When one is, it appears here with its transaction.</Notice>
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {scan.data.logs.slice(0, 25).map((log) => (
                  <li key={log.requestId} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <span className="num font-semibold">{usdc(log.amount)} USDC</span>
                    <span className="text-muted">
                      block <span className="num">{log.blockNumber.toString()}</span>
                    </span>
                    <span className="flex gap-3">
                      <Link to={`/r/${log.requestId}?tx=${log.txHash}`} className="font-semibold text-accent-hover underline underline-offset-2">
                        Receipt
                      </Link>
                      <ExternalAnchor href={txUrl(log.txHash)}>Explorer</ExternalAnchor>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <p className="mt-4 text-xs text-subtle">
          Contract page on the explorer: <ExternalAnchor href={addressUrl(BOOK_ADDRESS)}>open</ExternalAnchor>
        </p>
      </Card>

      <Card>
        <h2 className="display text-xl font-semibold">Limitations</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-2">
          {LIMITATIONS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
