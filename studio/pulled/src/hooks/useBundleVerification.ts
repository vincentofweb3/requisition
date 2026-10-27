import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import type { Address, Hex } from 'viem'
import {
  CHAIN_ID,
  REQUISITION_TYPES,
  hashPurpose,
  requestIdOf,
  requisitionBookAbi,
  requisitionDomain,
  toMessage,
  type Bundle,
  type BundleRequest,
} from '@/lib/requisition'
import { BOOK_ADDRESS } from '@/lib/env'

export type CheckStatus = 'pass' | 'fail' | 'wait'
export interface Check {
  key: string
  label: string
  status: CheckStatus
  detail?: string
}

export type RowState = 'payable' | 'paid' | 'expired' | 'invalid' | 'not-buyer' | 'connect' | 'blocked'

export interface PaidRecord {
  agent: Address
  buyer: Address
  vendor: Address
  amount: bigint
  purposeHash: Hex
  expiresAt: bigint
  paidAt: bigint
  nonce: Hex
}

interface BaseRow {
  index: number
  request: BundleRequest
  id: Hex
  purposeOk: boolean
  signature: { ok: boolean; detail?: string }
  parity: { ok: boolean; detail?: string }
  used: boolean
  record?: PaidRecord
}

interface BaseResult {
  rows: BaseRow[]
  chainTime: number
  fetchedAtMs: number
}

export interface VerifiedRow {
  index: number
  request: BundleRequest
  id: Hex
  checks: Check[]
  state: RowState
  record?: PaidRecord
}

const ERC6492_SUFFIX = '6492'.repeat(8)

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

/** Bundle-level problems that make every request unpayable. */
export function bundleProblem(bundle: Bundle): string | undefined {
  if (bundle.chainId !== CHAIN_ID) return `This bundle was signed for chain ${bundle.chainId}, not Arc Testnet (${CHAIN_ID}).`
  if (!BOOK_ADDRESS) return 'This app has no RequisitionBook address configured.'
  if (bundle.contract.toLowerCase() !== BOOK_ADDRESS.toLowerCase()) {
    return `This bundle targets ${bundle.contract}, not the RequisitionBook this app uses (${BOOK_ADDRESS}).`
  }
  return undefined
}

export function useNowSeconds(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

export function useBundleVerification(bundle: Bundle | undefined, account: Address | undefined) {
  const client = usePublicClient({ chainId: CHAIN_ID })
  const problem = bundle ? bundleProblem(bundle) : undefined
  const bundleKey = bundle ? `${bundle.contract}:${bundle.requests.map((r) => r.signature).join(',')}` : ''
  const now = useNowSeconds()

  const query = useQuery<BaseResult>({
    queryKey: ['bundle-verification', bundleKey],
    enabled: Boolean(bundle && client && !problem),
    staleTime: 0,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!bundle || !client || !BOOK_ADDRESS) throw new Error('Not ready')
      const book = BOOK_ADDRESS
      const domain = requisitionDomain(CHAIN_ID, book)

      const block = await client.getBlock()

      const signatures = await mapLimit(bundle.requests, 6, async (r) => {
        if (r.signature.toLowerCase().endsWith(ERC6492_SUFFIX)) {
          return { ok: false, detail: 'ERC-6492 wrapped signatures are not supported by the contract.' }
        }
        try {
          const ok = await client.verifyTypedData({
            address: r.agent,
            domain,
            types: REQUISITION_TYPES,
            primaryType: 'Requisition',
            message: toMessage(r),
            signature: r.signature,
          })
          return ok ? { ok } : { ok, detail: 'The signature does not recover to the agent address.' }
        } catch (error) {
          return { ok: false, detail: error instanceof Error ? error.message.split('\n')[0] : 'Signature check failed.' }
        }
      })

      const ids = bundle.requests.map((r) => requestIdOf(CHAIN_ID, book, r))
      const reads = await client.multicall({
        allowFailure: true,
        contracts: bundle.requests.flatMap((r, i) => [
          { address: book, abi: requisitionBookAbi, functionName: 'hashRequisition', args: [toMessage(r)] } as const,
          { address: book, abi: requisitionBookAbi, functionName: 'used', args: [ids[i]] } as const,
        ]),
      })

      const usedIndexes: number[] = []
      const rows: BaseRow[] = bundle.requests.map((request, i) => {
        const hashRead = reads[i * 2]
        const usedRead = reads[i * 2 + 1]
        if (hashRead.status !== 'success' || usedRead.status !== 'success') {
          throw new Error('Could not read the RequisitionBook contract on Arc Testnet.')
        }
        const onchain = hashRead.result as Hex
        const used = usedRead.result as boolean
        if (used) usedIndexes.push(i)
        return {
          index: i,
          request,
          id: ids[i],
          purposeOk: hashPurpose(request.purpose) === request.purposeHash,
          signature: signatures[i],
          parity:
            onchain.toLowerCase() === ids[i].toLowerCase()
              ? { ok: true }
              : { ok: false, detail: 'The contract computes a different digest than this app.' },
          used,
        }
      })

      if (usedIndexes.length > 0) {
        await mapLimit(usedIndexes, 4, async (i) => {
          try {
            const [agent, buyer, vendor, amount, purposeHash, expiresAt, paidAt, nonce] = await client.readContract({
              address: book,
              abi: requisitionBookAbi,
              functionName: 'records',
              args: [ids[i]],
            })
            rows[i].record = { agent, buyer, vendor, amount, purposeHash, expiresAt, paidAt, nonce }
          } catch {
            // The row still shows as paid; only the extra detail is missing.
          }
        })
      }

      return { rows, chainTime: Number(block.timestamp), fetchedAtMs: Date.now() }
    },
  })

  const verified = useMemo<VerifiedRow[]>(() => {
    if (!bundle) return []
    if (problem) {
      return bundle.requests.map((request, index) => ({
        index,
        request,
        id: BOOK_ADDRESS ? requestIdOf(CHAIN_ID, BOOK_ADDRESS, request) : ('0x'),
        state: 'blocked' as const,
        checks: [{ key: 'bundle', label: 'Chain and contract match', status: 'fail' as const, detail: problem }],
      }))
    }
    const base = query.data
    if (!base) return []
    const chainNow = base.chainTime + Math.max(0, (now * 1000 - base.fetchedAtMs) / 1000)
    return base.rows.map((row): VerifiedRow => {
      const { request } = row
      const expired = request.expiresAt <= chainNow
      const buyerCheck: Check = !account
        ? { key: 'buyer', label: 'Buyer is the connected wallet', status: 'wait', detail: 'Connect the buyer wallet to continue.' }
        : account.toLowerCase() === request.buyer.toLowerCase()
          ? { key: 'buyer', label: 'Buyer is the connected wallet', status: 'pass' }
          : { key: 'buyer', label: 'Buyer is the connected wallet', status: 'fail', detail: `This request names ${request.buyer} as buyer.` }
      const checks: Check[] = [
        { key: 'chain', label: 'Chain and contract match', status: 'pass' },
        row.purposeOk
          ? { key: 'purpose', label: 'Purpose hash matches the text', status: 'pass' }
          : { key: 'purpose', label: 'Purpose hash matches the text', status: 'fail', detail: 'keccak256 of the purpose text differs from purposeHash.' },
        row.signature.ok
          ? { key: 'signature', label: 'Agent signature is valid', status: 'pass' }
          : { key: 'signature', label: 'Agent signature is valid', status: 'fail', detail: row.signature.detail },
        row.parity.ok
          ? { key: 'parity', label: 'Contract digest matches', status: 'pass' }
          : { key: 'parity', label: 'Contract digest matches', status: 'fail', detail: row.parity.detail },
        expired
          ? { key: 'expiry', label: 'Not expired', status: 'fail', detail: 'The request is past its expiry.' }
          : { key: 'expiry', label: 'Not expired', status: 'pass' },
        buyerCheck,
        row.used
          ? { key: 'unused', label: 'Not already paid', status: 'fail', detail: 'This request has already been paid.' }
          : { key: 'unused', label: 'Not already paid', status: 'pass' },
      ]
      let state: RowState
      if (row.used) state = 'paid'
      else if (!row.purposeOk || !row.signature.ok || !row.parity.ok) state = 'invalid'
      else if (expired) state = 'expired'
      else if (!account) state = 'connect'
      else if (account.toLowerCase() !== request.buyer.toLowerCase()) state = 'not-buyer'
      else state = 'payable'
      return { index: row.index, request, id: row.id, checks, state, record: row.record }
    })
  }, [bundle, problem, query.data, account, now])

  return {
    rows: verified,
    problem,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error.message : undefined,
    refetch: query.refetch,
    now,
  }
}
