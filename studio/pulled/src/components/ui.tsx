import { useState, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react'
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { shortAddress } from '@/lib/format'
import { addressUrl } from '@/lib/env'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={clsx(
        'rounded-3xl border border-line bg-surface-strong p-6 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_12px_32px_-18px_rgba(18,45,69,0.25)] backdrop-blur',
        className,
      )}
    >
      {children}
    </section>
  )
}

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  variant?: 'primary' | 'ghost' | 'quiet'
  loading?: boolean
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void | Promise<void>
}

export function Button({ variant = 'primary', loading, className, children, disabled, onClick, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      onClick={(event) => {
        void onClick?.(event)
      }}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-accent text-white hover:bg-accent-hover',
        variant === 'ghost' && 'border border-line-strong bg-surface text-ink hover:bg-white',
        variant === 'quiet' && 'text-ink-2 hover:bg-surface-muted',
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        navigator.clipboard.writeText(value).then(
          () => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          },
          () => setCopied(false),
        )
      }}
      className="inline-flex size-7 items-center justify-center rounded-full text-subtle transition hover:bg-surface-muted hover:text-ink"
    >
      {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
    </button>
  )
}

export function AddressChip({ address, full }: { address: string; full?: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <a
        href={addressUrl(address)}
        target="_blank"
        rel="noopener noreferrer"
        className="mono text-[13px] text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-accent-hover"
        title={address}
      >
        {full ? address : shortAddress(address)}
      </a>
      <CopyButton value={address} label="Copy address" />
    </span>
  )
}

export function ExternalAnchor({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-medium text-accent-hover underline decoration-transparent underline-offset-2 transition hover:decoration-current"
    >
      {children}
      <ExternalLink className="size-3.5" aria-hidden />
    </a>
  )
}

type Tone = 'ok' | 'bad' | 'neutral' | 'caution'
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
        tone === 'ok' && 'bg-ok/10 text-ok',
        tone === 'bad' && 'bg-bad/10 text-bad',
        tone === 'caution' && 'bg-caution/10 text-caution',
        tone === 'neutral' && 'bg-surface-muted text-muted',
      )}
    >
      {children}
    </span>
  )
}

export function Notice({ tone = 'neutral', title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  return (
    <div
      role={tone === 'bad' ? 'alert' : 'status'}
      className={clsx(
        'rounded-2xl border px-4 py-3 text-sm',
        tone === 'bad' && 'border-bad/30 bg-bad/5 text-bad',
        tone === 'ok' && 'border-ok/30 bg-ok/5 text-ok',
        tone === 'caution' && 'border-caution/30 bg-caution/5 text-caution',
        tone === 'neutral' && 'border-line bg-surface-muted text-ink-2',
      )}
    >
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? 'mt-0.5' : ''}>{children}</div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="label-caps">{label}</p>
      <div className="mt-1 text-sm text-ink">{children}</div>
    </div>
  )
}

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-8">
      {eyebrow && <p className="label-caps">{eyebrow}</p>}
      <h1 className="display mt-1 text-4xl font-semibold text-ink sm:text-5xl">{title}</h1>
      {children && <p className="mt-3 max-w-[60ch] text-base text-muted">{children}</p>}
    </header>
  )
}
