import { createConfig, http } from "wagmi";
import { injected } from "@wagmi/core";
import { arc } from "./config";

export const wagmiConfig = createConfig({
  chains: [arc],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [arc.id]: http(arc.rpcUrls.default.http[0])
  },
  ssr: false
});
