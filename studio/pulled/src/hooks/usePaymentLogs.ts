import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { parseAbiItem, type Address, type Hex } from 'viem'
import { BOOK_ADDRESS, DEPLOY_BLOCK } from '@/lib/env'
import { CHAIN_ID } from '@/lib/requisition'

const paidEvent = parseAbiItem(
  'event RequisitionPaid(bytes32 indexed requestId, address indexed agent, address indexed buyer, address vendor, uint256 amount, bytes32 purposeHash, uint64 expiresAt, bytes32 nonce)',
)

/** Range per eth_getLogs call. Larger ranges were rejected by the public RPC when tested. */
const CHUNK = 2_000n
/** Never scan more than this many chunks in one pass. */
const MAX_CHUNKS = 40n

export interface PaymentLog {
  requestId: Hex
  agent: Address
  buyer: Address
  vendor: Address
  amount: bigint
  blockNumber: bigint
  txHash: Hex
}

export interface PaymentLogScan {
  logs: PaymentLog[]
  head: bigint
  fromBlock: bigint
  /** True when the scan started at the deployment block, so it covers every payment ever made. */
  complete: boolean
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Scans RequisitionPaid logs forward from the deployment block (or a bounded window behind head). */
export function usePaymentLogs() {
  const client = usePublicClient({ chainId: CHAIN_ID })
  return useQuery<PaymentLogScan>({
    queryKey: ['payment-logs', BOOK_ADDRESS],
    enabled: Boolean(client && BOOK_ADDRESS && DEPLOY_BLOCK !== undefined),
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!client || !BOOK_ADDRESS || DEPLOY_BLOCK === undefined) throw new Error('Not ready')
      const head = await client.getBlockNumber()
      const windowStart = head > CHUNK * MAX_CHUNKS ? head - CHUNK * MAX_CHUNKS : 0n
      const fromBlock = windowStart > DEPLOY_BLOCK ? windowStart : DEPLOY_BLOCK
      const logs: PaymentLog[] = []

      for (let start = fromBlock; start <= head; start += CHUNK) {
        const end = start + CHUNK - 1n > head ? head : start + CHUNK - 1n
        let attempt = 0
        for (;;) {
          try {
            const found = await client.getLogs({ address: BOOK_ADDRESS, event: paidEvent, fromBlock: start, toBlock: end })
            for (const log of found) {
              logs.push({
                requestId: log.args.requestId as Hex,
                agent: log.args.agent as Address,
                buyer: log.args.buyer as Address,
                vendor: log.args.vendor as Address,
                amount: log.args.amount as bigint,
                blockNumber: log.blockNumber,
                txHash: log.transactionHash,
              })
            }
            break
          } catch (error) {
            attempt += 1
            if (attempt >= 4) throw error
            await sleep(500 * attempt)
          }
        }
      }
      logs.sort((a, b) => (a.blockNumber === b.blockNumber ? 0 : a.blockNumber < b.blockNumber ? 1 : -1))
      return { logs, head, fromBlock, complete: fromBlock === DEPLOY_BLOCK }
    },
  })
}
