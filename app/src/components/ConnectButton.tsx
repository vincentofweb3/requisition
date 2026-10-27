import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { arc } from "../lib/config";
import { shortAddress } from "../lib/format";

export function ConnectButton() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const injectedConnector = connectors[0];

  if (!isConnected) {
    return (
      <button
        className="button button-connect"
        type="button"
        disabled={!injectedConnector || isPending}
        onClick={() => {
          if (injectedConnector) connect({ connector: injectedConnector });
        }}
        title={error ? error.message : undefined}
      >
        {isPending ? "Connecting..." : "Connect wallet"}
      </button>
    );
  }

  return (
    <div className="wallet-cluster">
      {chain && chain.id !== arc.id && (
        <button
          className="button button-warning"
          type="button"
          disabled={isSwitching}
          onClick={() => switchChain({ chainId: arc.id })}
        >
          {isSwitching ? "Switching..." : `Switch to ${arc.name}`}
        </button>
      )}
      <span className="wallet-chip" title={address}>
        {address ? shortAddress(address) : "Connected"}
      </span>
      <button
        className="button button-ghost button-small"
        type="button"
        onClick={() => disconnect()}
      >
        Disconnect
      </button>
    </div>
  );
}
