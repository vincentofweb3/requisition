# Architecture

```text
Agent CLI (EIP-712 signing, no funds)
        |
        | bundle JSON / #b= link
        v
Browser Desk (verify signature, purpose, chain, contract, expiry, buyer, replay)
        |
        | approve exact total, then pay/payBatch
        v
RequisitionBook (Arc) -- direct USDC transfer --> Vendor A
        |                                       -> Vendor B
        | RequisitionPaid event
        v
Receipt / Proof pages (independent chain reads)

Arc Studio (testnet origin) -> pull/review -> Arc Foundry (mainnet deploy)
```

## Contract

`RequisitionBook` is a single non-upgradeable Solidity contract. It stores `used[requestId]`, `records[requestId]`, and `totalPaid`. `pay` validates and settles one request. `payBatch` loops over up to 50 requests, validates and records each, then transfers each; any failure reverts the transaction. There is no custody and no admin surface.

## App

Vite + React + TypeScript. `BrowserRouter` routes `/`, `/desk`, `/r/:requestId`, `/proof`, and `/docs`. Bundles travel in the `#b=` fragment, so they are not sent to the host. wagmi/viem reads the contract and asks the browser wallet for an exact USDC approval. No backend or database.

## CLI

TypeScript CLI in `cli/`. `create` and `batch` sign EIP-712 requests with an env/file key, emit a bundle, and print a link. `show` and `link` inspect a bundle. `verify` checks signatures, purpose hashes, expiry, and optionally the onchain digest via `hashRequisition`. The key is never printed.

## Deployment

Studio handles the testnet build and deployment. Mainnet is a separate human-approved Arc Foundry deployment from a keystore. The app is static and can be hosted on Vercel or any static host. Environment variables are public configuration, not secrets.

## Trust boundary

The browser and CLI are conveniences; the contract is the final verifier. The buyer's wallet must still confirm the transaction. The app cannot prove vendor delivery, and the contract cannot recover direct transfers.
