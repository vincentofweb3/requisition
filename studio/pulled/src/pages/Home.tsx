import { Link } from 'react-router-dom'
import { FileSignature, ScanSearch, Send, ShieldCheck } from 'lucide-react'
import { Card } from '@/components/ui'
import OpenBundle from '@/components/OpenBundle'

const steps = [
  {
    icon: FileSignature,
    title: 'An agent signs a request',
    body: 'Your agent signs an EIP-712 purchase request naming you as buyer, a vendor, an exact USDC amount, a purpose and an expiry. Nothing moves yet.',
  },
  {
    icon: ScanSearch,
    title: 'You open the link and verify',
    body: 'The Desk checks every signature, the purpose text against its hash, the expiry, and whether the request is already paid, before you can select it.',
  },
  {
    icon: Send,
    title: 'You pay one or a batch',
    body: 'You approve the exact total, then pay. USDC goes straight from your wallet to each vendor. The contract never holds it.',
  },
]

export default function Home() {
  return (
    <div className="space-y-14">
      <section className="grid items-start gap-8 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <p className="label-caps">Arc Testnet · USDC</p>
          <h1 className="display mt-2 text-5xl font-semibold leading-[1.02] text-ink sm:text-6xl">
            Agents ask.
            <br />
            You decide.
            <br />
            USDC goes straight to the vendor.
          </h1>
          <p className="mt-5 max-w-[56ch] text-lg text-muted">
            Requisition lets an AI agent prepare purchase requests as signed messages. You verify each one in your browser
            and pay with your own wallet. The contract has no custody, no admin, no fees and no upgrade path.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="size-4 text-ok" aria-hidden /> Only the named buyer can pay
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="size-4 text-ok" aria-hidden /> Each request pays once
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="size-4 text-ok" aria-hidden /> Batches succeed or fail together
            </span>
          </div>
          <p className="mt-6 text-sm text-muted">
            Want to see what is live? Read the{' '}
            <Link to="/proof" className="font-semibold text-accent-hover underline underline-offset-2">
              onchain proof
            </Link>
            .
          </p>
        </div>

        <Card>
          <h2 className="display text-2xl font-semibold">Open a bundle</h2>
          <p className="mb-4 mt-1 text-sm text-muted">Paste the link or JSON from your agent. Nothing is sent anywhere until you pay.</p>
          <OpenBundle />
        </Card>
      </section>

      <section aria-labelledby="how">
        <h2 id="how" className="display mb-5 text-3xl font-semibold">
          How it works
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title}>
              <Card className="h-full">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-2xl bg-surface-muted text-ink">
                    <step.icon className="size-5" aria-hidden />
                  </span>
                  <span className="label-caps">Step {i + 1}</span>
                </div>
                <h3 className="display mt-4 text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted">{step.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-3xl border border-line bg-surface-muted p-6 text-sm text-ink-2">
        <p className="font-semibold text-ink">What this is not</p>
        <p className="mt-1 max-w-[70ch]">
          It is not an escrow and not a wallet. A signed request is only a proposal until you submit it, and you can ignore it.
          This is testnet software with no third-party audit. Read the{' '}
          <Link to="/docs" className="font-semibold text-accent-hover underline underline-offset-2">
            docs
          </Link>{' '}
          for the schema and limits.
        </p>
      </section>
    </div>
  )
}
