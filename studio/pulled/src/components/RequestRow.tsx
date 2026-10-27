import { Link } from 'react-router-dom'
import { Check, ChevronDown, CircleAlert, Clock } from 'lucide-react'
import clsx from 'clsx'
import type { RowState, VerifiedRow } from '@/hooks/useBundleVerification'
import { formatDateTime, shortHash, timeLeft, usdc } from '@/lib/format'
import { AddressChip, Badge } from './ui'

const BADGES: Record<RowState, { tone: 'ok' | 'bad' | 'neutral' | 'caution'; label: string }> = {
  payable: { tone: 'ok', label: 'Verified' },
  paid: { tone: 'neutral', label: 'Already paid' },
  expired: { tone: 'caution', label: 'Expired' },
  invalid: { tone: 'bad', label: 'Failed checks' },
  'not-buyer': { tone: 'caution', label: 'Different buyer' },
  connect: { tone: 'neutral', label: 'Connect to pay' },
  blocked: { tone: 'bad', label: 'Blocked' },
}

export default function RequestRow({
  row,
  selected,
  onToggle,
  now,
}: {
  row: VerifiedRow
  selected: boolean
  onToggle: () => void
  now: number
}) {
  const { request } = row
  const badge = BADGES[row.state]
  const selectable = row.state === 'payable'
  const inputId = `req-${row.index}`

  return (
    <li
      className={clsx(
        'rounded-3xl border bg-surface-strong p-4 transition sm:p-5',
        selected ? 'border-line-strong shadow-[0_10px_28px_-18px_rgba(18,45,69,0.45)]' : 'border-line',
        !selectable && 'opacity-90',
      )}
    >
      <div className="flex items-start gap-4">
        <input
          id={inputId}
          type="checkbox"
          checked={selected}
          disabled={!selectable}
          onChange={onToggle}
          aria-label={`Select request ${row.index + 1}`}
          className="mt-1.5 size-5 shrink-0 accent-[#122d45] disabled:cursor-not-allowed"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="display num text-3xl font-semibold text-ink">
                {usdc(request.amount)} <span className="text-base font-medium text-muted">USDC</span>
              </p>
              <p className="mt-1 text-sm text-muted">
                to <AddressChip address={request.vendor} />
              </p>
            </div>
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </div>

          <p className="mt-3 max-w-[65ch] whitespace-pre-wrap break-words text-[15px] text-ink">{request.purpose}</p>

          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Expiry</dt>
              <Clock className="size-3.5" aria-hidden />
              <dd className="num">
                {timeLeft(request.expiresAt, now)} · {formatDateTime(request.expiresAt)}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt>Agent</dt>
              <dd>
                <AddressChip address={request.agent} />
              </dd>
            </div>
          </dl>

          {row.record && (
            <p className="mt-3 text-sm">
              <Link to={`/r/${row.id}`} className="font-semibold text-accent-hover underline underline-offset-2">
                View receipt
              </Link>{' '}
              <span className="text-muted">· paid {formatDateTime(row.record.paidAt)} by {row.record.buyer.slice(0, 8)}…</span>
            </p>
          )}

          <details className="group mt-3">
            <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 text-sm font-medium text-ink-2">
              <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
              Checks
              <span className="mono ml-2 text-xs text-subtle">{shortHash(row.id)}</span>
            </summary>
            <ul className="mt-2 space-y-1.5 rounded-2xl bg-surface-muted p-3 text-sm">
              {row.checks.map((check) => (
                <li key={check.key} className="flex items-start gap-2">
                  {check.status === 'pass' ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-label="Passed" />
                  ) : check.status === 'wait' ? (
                    <Clock className="mt-0.5 size-4 shrink-0 text-subtle" aria-label="Waiting" />
                  ) : (
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-label="Failed" />
                  )}
                  <span>
                    <span className="text-ink">{check.label}</span>
                    {check.detail && check.status !== 'pass' && <span className="block break-words text-muted">{check.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </li>
  )
}
