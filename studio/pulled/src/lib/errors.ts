import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from 'viem'

const CONTRACT_ERRORS: Record<string, string> = {
  NotBuyer: 'The connected wallet is not the buyer named on this request.',
  ZeroAgent: 'The request names no agent.',
  ZeroVendor: 'The request names no vendor.',
  VendorIsContract: 'The vendor cannot be the RequisitionBook contract.',
  ZeroAmount: 'The request amount is zero.',
  ZeroPurposeHash: 'The request has no purpose hash.',
  Expired: 'A selected request has expired.',
  AlreadyUsed: 'A selected request has already been paid.',
  InvalidSignature: 'A selected request has an invalid agent signature.',
  EmptyBatch: 'Select at least one request.',
  LengthMismatch: 'Requests and signatures do not line up.',
  BatchTooLarge: 'A batch holds at most 50 requests.',
}

export interface HumanError {
  /** User rejected the wallet prompt. Not an error worth shouting about. */
  cancelled: boolean
  message: string
}

export function humanizeError(error: unknown): HumanError {
  if (error instanceof BaseError) {
    if (error.walk((e) => e instanceof UserRejectedRequestError)) {
      return { cancelled: true, message: 'Cancelled in your wallet.' }
    }
    const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError)
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName
      if (name && CONTRACT_ERRORS[name]) return { cancelled: false, message: CONTRACT_ERRORS[name] }
      if (reverted.reason) return { cancelled: false, message: friendlyReason(reverted.reason) }
    }
    return { cancelled: false, message: friendlyReason(error.shortMessage || error.message) }
  }
  if (error instanceof Error) {
    if ((error as { code?: number }).code === 4001) return { cancelled: true, message: 'Cancelled in your wallet.' }
    return { cancelled: false, message: friendlyReason(error.message) }
  }
  return { cancelled: false, message: 'Something went wrong. Please try again.' }
}

function friendlyReason(raw: string): string {
  const text = raw.toLowerCase()
  if (text.includes('user rejected') || text.includes('user denied')) return 'Cancelled in your wallet.'
  if (text.includes('allowance')) return 'USDC allowance is too low. Approve the exact total first.'
  if (text.includes('exceeds balance') || text.includes('insufficient balance')) return 'Your USDC balance is too low for this payment.'
  if (text.includes('blacklist') || text.includes('blocklist') || text.includes('blocked')) {
    return 'USDC refused the transfer: a sender or recipient address is blocklisted.'
  }
  if (text.includes('insufficient funds')) return 'Not enough USDC to cover gas. Use "Get test USDC" in the sidebar.'
  if (text.includes('connector not found') || text.includes('provider not found')) {
    return 'No browser wallet was found. Install an injected wallet such as MetaMask or Rabby.'
  }
  if (text.includes('network') || text.includes('timeout') || text.includes('failed to fetch')) {
    return 'Network issue while reaching Arc Testnet. Check your connection and retry.'
  }
  const trimmed = raw.split('\n')[0]
  return trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed
}
