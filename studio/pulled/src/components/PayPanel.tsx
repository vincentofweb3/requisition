import { useState } from 'react'
import { Link } from 'react-router-dom'
import { erc20Abi, parseEventLogs, zeroAddress, type Hex } from 'viem'
import { usePublicClient, useReadContracts, useWriteContract } from 'wagmi'
import { toast } from 'sonner'
import type { VerifiedRow } from '@/hooks/useBundleVerification'
import { useWalletActions } from '@/hooks/useWalletActions'
import { BOOK_ADDRESS, USDC_ADDRESS, txUrl } from '@/lib/env'
import { humanizeError } from '@/lib/errors'
import { usdc, shortHash } from '@/lib/format'
import { CHAIN_ID, requisitionBookAbi, toMessage } from '@/lib/requisition'
import { Button, Card, ExternalAnchor, Notice } from './ui'

type Phase = 'idle' | 'approving' | 'approve-confirming' | 'paying' | 'pay-confirming'

interface PaidResult {
  hash: Hex
  ids: Hex[]
}

const PHASE_LABEL: Record<Phase, string> = {
  idle: '',
  approving: 'Confirm the approval in your wallet',
  'approve-confirming': 'Waiting for the approval to confirm',
  paying: 'Confirm the payment in your wallet',
  'pay-confirming': 'Waiting for the payment to confirm',
}

export default function PayPanel({ selected, onPaid }: { selected: VerifiedRow[]; onPaid: () => void }) {
  const wallet = useWalletActions()
  const client = usePublicClient({ chainId: CHAIN_ID })
  const { writeContractAsync } = useWriteContract()
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string>()
  const [result, setResult] = useState<PaidResult>()

  const total = selected.reduce((sum, row) => sum + BigInt(row.request.amount), 0n)
  const owner = wallet.address ?? zeroAddress
  const book = BOOK_ADDRESS

  const { data, refetch } = useReadContracts({
    allowFailure: false,
    contracts: [
      { chainId: CHAIN_ID, address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [owner] },
      { chainId: CHAIN_ID, address: USDC_ADDRESS, abi: erc20Abi, functionName: 'allowance', args: [owner, book ?? zeroAddress] },
    ],
    query: { enabled: Boolean(wallet.address && book), refetchInterval: 20_000 },
  })
  const balance = data?.[0]
  const allowance = data?.[1]

  const busy = phase !== 'idle'
  const needsApproval = allowance !== undefined && allowance < total
  const lowBalance = balance !== undefined && balance < total

  async function waitFor(hash: Hex, what: string) {
    if (!client) throw new Error('No connection to Arc Testnet.')
    const receipt = await client.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') throw new Error(`${what} reverted onchain.`)
    return receipt
  }

  async function approve() {
    if (!book) return
    setError(undefined)
    try {
      setPhase('approving')
      const hash = await writeContractAsync({
        chainId: CHAIN_ID,
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'approve',
        args: [book, total],
      })
      setPhase('approve-confirming')
      await waitFor(hash, 'The approval')
      await refetch()
      toast.success(`Approved exactly ${usdc(total)} USDC.`)
    } catch (e) {
      const human = humanizeError(e)
      if (!human.cancelled) setError(human.message)
    } finally {
      setPhase('idle')
    }
  }

  async function pay() {
    if (!book || !client || !wallet.address) return
    setError(undefined)
    setResult(undefined)
    const messages = selected.map((row) => toMessage(row.request))
    const signatures = selected.map((row) => row.request.signature)
    try {
      setPhase('paying')
      let hash: Hex
      if (messages.length === 1) {
        await client.simulateContract({
          account: wallet.address,
          address: book,
          abi: requisitionBookAbi,
          functionName: 'pay',
          args: [messages[0], signatures[0]],
        })
        hash = await writeContractAsync({
          chainId: CHAIN_ID,
          address: book,
          abi: requisitionBookAbi,
          functionName: 'pay',
          args: [messages[0], signatures[0]],
        })
      } else {
        await client.simulateContract({
          account: wallet.address,
          address: book,
          abi: requisitionBookAbi,
          functionName: 'payBatch',
          args: [messages, signatures],
        })
        hash = await writeContractAsync({
          chainId: CHAIN_ID,
          address: book,
          abi: requisitionBookAbi,
          functionName: 'payBatch',
          args: [messages, signatures],
        })
      }
      setPhase('pay-confirming')
      const receipt = await waitFor(hash, 'The payment')
      const logs = parseEventLogs({ abi: requisitionBookAbi, eventName: 'RequisitionPaid', logs: receipt.logs })
      const ids = logs.filter((log) => log.address.toLowerCase() === book.toLowerCase()).map((log) => log.args.requestId)
      setResult({ hash, ids })
      onPaid()
      void refetch()
    } catch (e) {
      const human = humanizeError(e)
      if (!human.cancelled) setError(human.message)
    } finally {
      setPhase('idle')
    }
  }

  let action: { label: string; onClick: () => void | Promise<void>; disabled?: boolean; loading?: boolean }
  if (!wallet.isConnected) action = { label: 'Connect wallet', onClick: wallet.connect, loading: wallet.connecting }
  else if (!wallet.onArc) action = { label: 'Switch to Arc Testnet', onClick: wallet.switchToArc, loading: wallet.switching }
  else if (selected.length === 0) action = { label: 'Select requests to pay', onClick: () => undefined, disabled: true }
  else if (lowBalance) action = { label: 'USDC balance too low', onClick: () => undefined, disabled: true }
  else if (allowance === undefined) action = { label: 'Reading allowance…', onClick: () => undefined, disabled: true }
  else if (needsApproval) action = { label: `Approve exactly ${usdc(total)} USDC`, onClick: approve, loading: busy }
  else action = { label: `Pay ${usdc(total)} USDC`, onClick: pay, loading: busy }

  return (
    <div className="space-y-4">
      <Card>
        <p className="label-caps">You pay</p>
        <p className="display num mt-1 text-5xl font-semibold">
          {usdc(total)} <span className="text-xl font-medium text-muted">USDC</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          {selected.length === 0
            ? 'Nothing selected'
            : `${selected.length} request${selected.length === 1 ? '' : 's'}, sent directly to ${selected.length === 1 ? 'the vendor' : 'each vendor'}`}
        </p>

        <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Your USDC balance</dt>
            <dd className="num">{balance === undefined ? '—' : `${usdc(balance)} USDC`}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Current allowance</dt>
            <dd className="num">{allowance === undefined ? '—' : `${usdc(allowance)} USDC`}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-subtle">
          Gas on Arc is paid in the same USDC. The approval is for exactly this total, never unlimited.
        </p>

        <Button className="mt-5 w-full" onClick={action.onClick} disabled={action.disabled} loading={action.loading}>
          {busy ? PHASE_LABEL[phase] : action.label}
        </Button>

        {lowBalance && balance !== undefined && (
          <div className="mt-3">
            <Notice tone="caution">
              You need {usdc(total)} USDC but hold {usdc(balance)}. Use “Get test USDC” in the Studio sidebar, or deselect some requests.
            </Notice>
          </div>
        )}
        {error && (
          <div className="mt-3">
            <Notice tone="bad" title="Could not complete">
              {error}
            </Notice>
          </div>
        )}
      </Card>

      {result && (
        <Card>
          <Notice tone="ok" title="Payment confirmed">
            {result.ids.length} request{result.ids.length === 1 ? '' : 's'} paid in one transaction.
          </Notice>
          <p className="mt-3 text-sm">
            <ExternalAnchor href={txUrl(result.hash)}>
              <span className="mono">{shortHash(result.hash)}</span>
            </ExternalAnchor>
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {result.ids.map((id) => (
              <li key={id}>
                <Link to={`/r/${id}?tx=${result.hash}`} className="mono text-accent-hover underline underline-offset-2">
                  Receipt {shortHash(id)}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
