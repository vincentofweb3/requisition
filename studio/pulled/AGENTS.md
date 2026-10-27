# Requisition

> Built with Arc Studio - money-powered apps in minutes

Project memory for future agents and humans.

## What This App Does

Agent-signed EIP-712 purchase requests (`Requisition`) that the named human buyer verifies in the browser and pays, singly or as an atomic batch (max 50). USDC moves buyer -> vendor directly. The contract is non-custodial: no owner, admin, upgrade, fees, withdraw, refund or cancel. The request id is the EIP-712 digest. Arc Testnet only.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS, react-router-dom (path routing; bundle lives in the `#b=` fragment)
- Web3: wagmi v2, viem, injected wallet only (`useWalletActions`)
- Contracts: Solidity 0.8.28 + Foundry. `contracts/RequisitionBook.sol`, tests in `contracts/test/` (75 tests incl. invariants). `bun run contracts:build`, `bun run contracts:test`.
- Chain: Arc Testnet (5042002). USDC `0x3600000000000000000000000000000000000000` (6 decimals, also gas).

## Deployments

- RequisitionBook (Arc Testnet): `0x578d3006f5a5c34149d5206caac008f544510cbd`
- Deploy tx: `0xff9d5fce44fa0c1925c9282b7e909e2972f3e6ea74dc537181db7a31a1ba389f` (block 69402196)
- Constructor arg: USDC address above. Deployed from the shared platform deployer, which has no special rights on the contract.
- Addresses are read from `.env` (`VITE_REQUISITION_BOOK_ADDRESS`, `..._DEPLOY_BLOCK`, `..._DEPLOY_TX`). Restart the dev server after changing `.env`.

## Key Files

- `src/lib/requisition.ts` - shared schema, ABI, EIP-712 types, bundle codec (also used by `scripts/create-bundle.ts`)
- `src/hooks/useBundleVerification.ts` - per-request checks (signature via viem `verifyTypedData`, purpose hash, onchain digest parity, expiry, buyer, used)
- `src/components/PayPanel.tsx` - exact approval, simulate, `pay` or `payBatch`
- `src/pages/` - Home, Desk, Receipt, Proof, Docs
- `src/hooks/usePaymentLogs.ts` - bounded `getLogs` scan from the deploy block (2000-block chunks; larger ranges were rejected by the public RPC)

## Decisions

- Signature check uses OpenZeppelin SignatureChecker (EOA + ERC-1271). ERC-6492 is rejected.
- Never approve more than the selected total.
- No fake data anywhere; Proof page reads chain state live.
- Studio URL on the Proof page is the live share base unless `VITE_STUDIO_WEB_URL` is set.
- No third-party audit. Do not claim one.

## To Run

```bash
bun install
bun run dev
```
