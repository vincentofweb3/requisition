import { isAddress, isHex, type Address, type Hex } from 'viem'
import { buildAddressExplorerUrl, buildTxExplorerUrl, getUsdc, requireChain } from '@/onchain-facts'
import { CHAIN_ID } from './requisition'

export const CHAIN = requireChain(CHAIN_ID)

const usdcFact = getUsdc(CHAIN_ID)
if (!usdcFact || !isAddress(usdcFact.address)) throw new Error('USDC is not registered for Arc Testnet.')
export const USDC_ADDRESS = usdcFact.address

const rawAddress = import.meta.env.VITE_REQUISITION_BOOK_ADDRESS as string | undefined
/** Deployed RequisitionBook. Undefined means the app is not configured yet. */
export const BOOK_ADDRESS: Address | undefined = rawAddress && isAddress(rawAddress) ? (rawAddress) : undefined

const rawBlock = import.meta.env.VITE_REQUISITION_BOOK_DEPLOY_BLOCK as string | undefined
export const DEPLOY_BLOCK: bigint | undefined = rawBlock && /^[0-9]+$/.test(rawBlock) ? BigInt(rawBlock) : undefined

const rawTx = import.meta.env.VITE_REQUISITION_BOOK_DEPLOY_TX as string | undefined
export const DEPLOY_TX: Hex | undefined = rawTx && isHex(rawTx, { strict: true }) && rawTx.length === 66 ? (rawTx) : undefined

const rawStudio = import.meta.env.VITE_STUDIO_WEB_URL as string | undefined
/** Optional public Studio share URL, set once the app has been published. */
export const STUDIO_WEB_URL: string | undefined = rawStudio && /^https:\/\//.test(rawStudio) ? rawStudio : undefined

export const txUrl = (hash: string) => buildTxExplorerUrl(CHAIN_ID, hash)
export const addressUrl = (address: string) => buildAddressExplorerUrl(CHAIN_ID, address)
