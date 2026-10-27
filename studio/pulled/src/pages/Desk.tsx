import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { RefreshCw } from 'lucide-react'
import type { Hex } from 'viem'
import { useBundleVerification } from '@/hooks/useBundleVerification'
import { BundleError, parseBundleInput, type Bundle } from '@/lib/requisition'
import { BOOK_ADDRESS } from '@/lib/env'
import { usdc } from '@/lib/format'
import { Button, Card, Notice, PageTitle } from '@/components/ui'
import OpenBundle from '@/components/OpenBundle'
import PayPanel from '@/components/PayPanel'
import RequestRow from '@/components/RequestRow'

function useBundleFromHash(): { bundle?: Bundle; error?: string; empty: boolean } {
  const { hash } = useLocation()
  return useMemo(() => {
    if (!hash || hash === '#') return { empty: true }
    try {
      return { bundle: parseBundleInput(hash), empty: false }
    } catch (e) {
      return { error: e instanceof BundleError ? e.message : 'The bundle could not be read.', empty: false }
    }
  }, [hash])
}

export default function Desk() {
  const { bundle, error, empty } = useBundleFromHash()
  const { address } = useAccount()
  const verification = useBundleVerification(bundle, address)
  const { rows } = verification
  const [selected, setSelected] = useState<Set<Hex>>(new Set())
  const seededFor = useRef<string>('')

  const payableIds = useMemo(() => rows.filter((r) => r.state === 'payable').map((r) => r.id), [rows])
  const bundleKey = bundle ? bundle.requests.map((r) => r.signature).join('|') : ''

  // Pre-select every payable request once per bundle; afterwards only drop ids that stopped being payable.
  useEffect(() => {
    if (payableIds.length === 0 && seededFor.current !== bundleKey) return
    setSelected((current) => {
      if (seededFor.current !== bundleKey) {
        seededFor.current = bundleKey
        return new Set(payableIds)
      }
      const next = new Set([...current].filter((id) => payableIds.includes(id)))
      return next.size === current.size ? current : next
    })
  }, [payableIds, bundleKey])

  const selectedRows = rows.filter((r) => selected.has(r.id))
  const toggle = (id: Hex) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allSelected = payableIds.length > 0 && payableIds.every((id) => selected.has(id))

  if (!BOOK_ADDRESS) {
    return (
      <div>
        <PageTitle title="Desk" />
        <Notice tone="bad" title="Not configured">
          This app has no RequisitionBook address. Set VITE_REQUISITION_BOOK_ADDRESS and restart the dev server.
        </Notice>
      </div>
    )
  }

  if (empty || error || !bundle) {
    return (
      <div className="mx-auto max-w-xl">
        <PageTitle eyebrow="Desk" title="Open a bundle">
          Bundles arrive as a link that ends in #b=… Paste it here, or open the link directly.
        </PageTitle>
        {error && (
          <div className="mb-4">
            <Notice tone="bad" title="Could not read this bundle">
              {error}
            </Notice>
          </div>
        )}
        <Card>
          <OpenBundle />
        </Card>
      </div>
    )
  }

  const totalAll = rows.reduce((sum, r) => sum + BigInt(r.request.amount), 0n)

  return (
    <div>
      <PageTitle eyebrow="Desk" title="Review and pay">
        {bundle.requests.length} request{bundle.requests.length === 1 ? '' : 's'} totalling {usdc(totalAll)} USDC. Every request is
        checked in your browser against the contract before you can select it.
      </PageTitle>

      {verification.problem && (
        <div className="mb-5">
          <Notice tone="bad" title="This bundle cannot be paid here">
            {verification.problem}
          </Notice>
        </div>
      )}
      {verification.error && (
        <div className="mb-5">
          <Notice tone="bad" title="Verification failed">
            {verification.error}
          </Notice>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              disabled={payableIds.length === 0}
              onClick={() => setSelected(allSelected ? new Set() : new Set(payableIds))}
            >
              {allSelected ? 'Clear selection' : 'Select all verified'}
            </Button>
            <Button variant="quiet" onClick={() => void verification.refetch()} loading={verification.isFetching}>
              <RefreshCw className="size-4" aria-hidden />
              Re-check
            </Button>
          </div>

          {verification.isLoading && (
            <Notice>Verifying signatures and reading the contract on Arc Testnet…</Notice>
          )}

          <ul className="space-y-3">
            {rows.map((row) => (
              <RequestRow
                key={row.id + row.index}
                row={row}
                selected={selected.has(row.id)}
                onToggle={() => toggle(row.id)}
                now={verification.now}
              />
            ))}
          </ul>
        </div>

        <div className="lg:sticky lg:top-28">
          <PayPanel selected={selectedRows} onPaid={() => void verification.refetch()} />
        </div>
      </div>
    </div>
  )
}
