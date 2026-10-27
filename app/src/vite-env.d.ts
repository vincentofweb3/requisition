/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_USDC_ADDRESS?: string;
  readonly VITE_REQUISITION_BOOK?: string;
  readonly VITE_EXPLORER_URL?: string;
  readonly VITE_STUDIO_URL?: string;
  readonly VITE_REPO_URL?: string;
  readonly VITE_VIDEO_URL?: string;
  readonly VITE_DEPLOYMENT_TX?: string;
  readonly VITE_EXAMPLE_TX?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
