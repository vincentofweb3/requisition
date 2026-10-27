import { useCallback } from 'react'
import { useAccount, useConnect, useSwitchChain } from 'wagmi'
import { toast } from 'sonner'
import { CHAIN_ID } from '@/lib/requisition'
import { humanizeError } from '@/lib/errors'

/** Injected-wallet connect and Arc Testnet switch, with clear errors. */
export function useWalletActions() {
  const { address, chainId, isConnected } = useAccount()
  const { connectors, connectAsync, isPending: connecting } = useConnect()
  const { switchChainAsync, isPending: switching } = useSwitchChain()

  const connect = useCallback(async () => {
    const injected = connectors[0]
    if (!injected) {
      toast.error('No browser wallet was found. Install an injected wallet such as MetaMask or Rabby.')
      return
    }
    try {
      await connectAsync({ connector: injected, chainId: CHAIN_ID })
    } catch (error) {
      const human = humanizeError(error)
      if (!human.cancelled) toast.error(human.message)
    }
  }, [connectors, connectAsync])

  const switchToArc = useCallback(async () => {
    try {
      await switchChainAsync({ chainId: CHAIN_ID })
    } catch (error) {
      const human = humanizeError(error)
      if (!human.cancelled) toast.error(human.message)
    }
  }, [switchChainAsync])

  return {
    address,
    isConnected,
    onArc: chainId === CHAIN_ID,
    connect,
    connecting,
    switchToArc,
    switching,
  }
}
