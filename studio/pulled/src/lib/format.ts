import { formatUsdc } from '@/onchain-money'

export const shortAddress = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`
export const shortHash = (value: string) => `${value.slice(0, 10)}…${value.slice(-8)}`

export function usdc(raw: bigint | string): string {
  return formatUsdc(typeof raw === 'string' ? BigInt(raw) : raw)
}

export function formatDateTime(unixSeconds: number | bigint): string {
  const date = new Date(Number(unixSeconds) * 1000)
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function timeLeft(expiresAt: number, nowSeconds: number): string {
  const diff = expiresAt - nowSeconds
  if (diff <= 0) return 'Expired'
  if (diff < 90) return `${diff}s left`
  if (diff < 3600) return `${Math.floor(diff / 60)}m left`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m left`
  return `${Math.floor(diff / 86400)}d left`
}
