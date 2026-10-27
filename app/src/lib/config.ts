import { defineChain, getAddress, isAddress, type Address } from "viem";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const DEFAULT_USDC = "0x3600000000000000000000000000000000000000" as const;
const rawChainId = Number(import.meta.env.VITE_CHAIN_ID ?? "5042");
const chainId = Number.isFinite(rawChainId) && rawChainId > 0 ? rawChainId : 5042;
const isTestnet = chainId === 5042002;
const rpcUrl =
  import.meta.env.VITE_RPC_URL ??
  (isTestnet ? "https://rpc.testnet.arc.io" : "https://rpc.mainnet.arc.io");
const explorerUrl =
  import.meta.env.VITE_EXPLORER_URL ??
  (isTestnet ? "https://explorer.testnet.arc.io" : "https://explorer.arc.io");

function addressOrZero(value: string | undefined): Address {
  if (!value || !isAddress(value)) return ZERO_ADDRESS;
  return getAddress(value);
}

export const arc = defineChain({
  id: chainId,
  name: isTestnet ? "Arc Testnet" : "Arc",
  nativeCurrency: {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: [rpcUrl]
    }
  },
  blockExplorers: {
    default: {
      name: "Arc Explorer",
      url: explorerUrl
    }
  },
  testnet: isTestnet
});

export const appConfig = {
  chainId,
  chain: arc,
  isTestnet,
  rpcUrl,
  explorerUrl,
  usdc: addressOrZero(import.meta.env.VITE_USDC_ADDRESS ?? DEFAULT_USDC),
  contract: addressOrZero(import.meta.env.VITE_REQUISITION_BOOK),
  studioUrl: import.meta.env.VITE_STUDIO_URL ?? "",
  repoUrl: import.meta.env.VITE_REPO_URL ?? "",
  videoUrl: import.meta.env.VITE_VIDEO_URL ?? "",
  deploymentTx: import.meta.env.VITE_DEPLOYMENT_TX ?? "",
  exampleTx: import.meta.env.VITE_EXAMPLE_TX ?? ""
};

export const isConfigured = appConfig.contract !== ZERO_ADDRESS;

export function explorerAddress(address: string): string {
  return `${appConfig.explorerUrl}/address/${address}`;
}

export function explorerTx(hash: string): string {
  return `${appConfig.explorerUrl}/tx/${hash}`;
}
