import { NavLink, Outlet, Link } from 'react-router-dom'
import { useDisconnect } from 'wagmi'
import { TokenUSDC } from '@web3icons/react'
import { useWalletActions } from '@/hooks/useWalletActions'
import { shortAddress } from '@/lib/format'
import { Button } from './ui'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/desk', label: 'Desk' },
  { to: '/proof', label: 'Proof' },
  { to: '/docs', label: 'Docs' },
]

function WalletControl() {
  const { address, isConnected, onArc, connect, connecting, switchToArc, switching } = useWalletActions()
  const { disconnect } = useDisconnect()

  if (!isConnected || !address) {
    return (
      <Button loading={connecting} onClick={connect}>
        Connect wallet
      </Button>
    )
  }

  if (!onArc) {
    return (
      <Button loading={switching} onClick={switchToArc}>
        Switch to Arc Testnet
      </Button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => disconnect()}
      title="Disconnect"
      className="mono inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-[13px] text-ink transition hover:bg-white"
    >
      <span className="size-2 rounded-full bg-ok" aria-hidden />
      {shortAddress(address)}
    </button>
  )
}

export default function Layout() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="display flex items-center gap-2 text-xl font-semibold text-ink">
            <span className="grid size-8 place-items-center rounded-xl bg-accent text-white" aria-hidden>
              <TokenUSDC variant="mono" size={18} />
            </span>
            Requisition
          </Link>
          <nav aria-label="Primary" className="order-3 flex w-full gap-1 sm:order-none sm:w-auto">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition ${
                    isActive ? 'bg-accent text-white' : 'text-ink-2 hover:bg-surface-muted'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <WalletControl />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-28 pt-10">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-5xl px-4 pb-24 text-sm text-subtle">
        Arc Testnet only. Testnet USDC has no value. Requisition is unaudited software.
      </footer>
    </div>
  )
}
