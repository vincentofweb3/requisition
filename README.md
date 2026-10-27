# Requisition

**Your agent asks. You approve. USDC settles.**

An AI agent signs a typed purchase request. A human buyer opens a link, verifies the exact vendor, amount, purpose, and expiry, then pays one request or an atomic batch in USDC on Arc. The contract verifies the agent signature and the buyer; USDC moves directly from the buyer to the vendor. It never holds funds and has no owner, admin, upgrade, fee, or withdrawal path.

Built with **Arc Studio** on Arc Testnet. The mainnet deployment is a deliberate Arc Foundry handoff, not a Studio testnet claim.

## Live evidence

| Item | Value |
| --- | --- |
| Public repo | [github.com/vincentofweb3/requisition](https://github.com/vincentofweb3/requisition) |
| Arc Studio project | [studio.arc.io/app/d3a230c9-d4b1-4c08-8cf4-6b018d2e83c0](https://studio.arc.io/app/d3a230c9-d4b1-4c08-8cf4-6b018d2e83c0) (Circle login may be required) |
| Studio testnet preview | [ir1cfm2pu2r187whim18o.preview.studio.arc.io](https://ir1cfm2pu2r187whim18o.preview.studio.arc.io) |
| Testnet contract | [`0x578d3006f5a5c34149d5206caac008f544510cbd`](https://explorer.testnet.arc.io/address/0x578d3006f5a5c34149d5206caac008f544510cbd) |
| Testnet deployment tx | [`0xff9d5fce44fa0c1925c9282b7e909e2972f3e6ea74dc537181db7a31a1ba389f`](https://explorer.testnet.arc.io/tx/0xff9d5fce44fa0c1925c9282b7e909e2972f3e6ea74dc537181db7a31a1ba389f) |
| Testnet block | `69402196` |
| Contract tests | `75 passed, 0 failed, 0 skipped` |
| Public app | Pending Vercel deployment |
| Mainnet contract / tx | **Pending funding and explicit deployment approval** |

The testnet deployment is supporting evidence only. A real mainnet contract and a real mainnet USDC transaction are required for submission. This README does not claim either yet. See [docs/VERIFICATION.md](docs/VERIFICATION.md).

## What it is

Giving an agent a funded wallet creates a custody problem. Asking a human to copy an address from chat loses the request and the approval trail. Requisition is the approval layer between an agent deciding to buy something and money leaving a buyer's wallet:

1. **Agent signs** an EIP-712 `Requisition` with buyer, vendor, amount, purpose hash, expiry, and nonce. The agent key needs no gas and holds no funds.
2. **Buyer verifies** the signature, chain, contract, purpose hash, expiry, buyer, and replay status in the browser.
3. **Buyer pays** with an exact USDC approval. One request or up to 50 requests settle atomically; USDC moves directly to the vendors.

## Why Arc

Arc uses USDC as its gas token, so the buyer does not need a separate volatile gas asset. ERC-20 USDC uses 6 decimals while native gas uses 18; the app formats the ERC-20 amount and never mixes the two. Settlement is fast, and every payment emits a public `RequisitionPaid` event that can be checked on the explorer.

## EIP-712 schema

```text
Requisition(
  address agent,
  address buyer,
  address vendor,
  uint128 amount,
  bytes32 purposeHash,
  uint64 expiresAt,
  bytes32 nonce
)
```

Domain: `RequisitionBook`, version `1`, chain ID, verifying contract. The request ID is the EIP-712 digest; the contract uses it for replay protection and the receipt record. `purposeHash = keccak256(toBytes(purpose))`, so the purpose text stays offchain.

## Contract

`RequisitionBook` exposes:

- `pay(Requisition, signature)`
- `payBatch(Requisition[], signatures[])`, maximum 50
- `hashRequisition(Requisition)`
- `used(requestId)`, `records(requestId)`, `totalPaid()`, `usdc()`, `MAX_BATCH()`
- `RequisitionPaid(requestId, agent, buyer, vendor, amount, purposeHash, expiresAt, nonce)`

The buyer must be `msg.sender`; the agent must have signed the exact digest; expired, zero-value, already-used, and invalid-signature requests revert. A failed transfer reverts the whole batch. The contract has no owner, admin, upgrade, pause, fee, escrow, refund, or rescue function. It uses OpenZeppelin `EIP712`, `SignatureChecker` (EOA and ERC-1271), `SafeERC20`, and `ReentrancyGuard`.

## How Arc Studio was used

Studio generated the contract, 75-test Foundry suite, testnet deployment, and a React/Vite app. The testnet contract was read back independently: USDC is `0x3600...0000` and `MAX_BATCH` is `50`. We pulled the Studio artifacts, adopted the Studio contract as canonical, reran the full suite locally, and kept the Studio testnet URL and preview as evidence.

Studio deploys testnet only. Mainnet is an explicit handoff:

1. Pull and review Studio artifacts.
2. Run the full test suite locally.
3. Deploy with Arc Foundry from a human-controlled keystore.
4. Verify the deployed code and constructor on Arc.
5. Build and host the app with the mainnet address.
6. Execute a small real mainnet batch and record every hash.

The handoff is disclosed in the app and docs; the testnet deployment is not presented as mainnet evidence.

## Repository layout

```text
contracts/   Solidity contract, Foundry tests, deployment script, testnet manifest
app/         Vite + React + TypeScript app (wagmi/viem)
cli/         TypeScript agent CLI (req create/batch/show/verify/link)
studio/      Studio prompt and detached run metadata
docs/        Architecture, security, verification, limitations, demo
```

## Run locally

### Contracts

```bash
export PATH="$HOME/.local/bin:$PATH"
git submodule update --init --recursive
cd contracts
arc-forge build
arc-forge test -vvv
```

### App

```bash
cd app
npm install
cp .env.example .env
# Set VITE_REQUISITION_BOOK to the deployed contract address.
npm run typecheck
npm test
npm run build
npm run dev
```

### Agent CLI

```bash
cd cli
npm install
npm run build

AGENT_PRIVATE_KEY=0x... node dist/index.js create \
  --contract 0x... \
  --buyer 0x... \
  --vendor 0x... \
  --amount 0.01 \
  --purpose "Buy 10k API credits" \
  --expires-in 1h \
  --out req.json \
  --app-url http://localhost:5173
```

The key is read from `AGENT_PRIVATE_KEY` or `--agent-key-file`; it is never accepted as a command-line value. `req batch --input batch.json` signs a bundle. `req verify bundle.json --rpc-url ...` checks signatures, purpose hashes, expiry, and the onchain digest.

## Tests

```text
Contracts: 75 passed, 0 failed, 0 skipped (4 suites)
App:       18 unit tests passed
App build: typecheck, ESLint, Vite production build passed
CLI:       create, show, link, batch, and verify exercised against the Studio testnet contract
```

The CLI verification matched the contract's `hashRequisition` output for both requests in a two-request testnet bundle. No testnet payment was made; the Proof page shows `0 USDC` paid.

## Deployment and verification

The mainnet deployment command, once a human-controlled keystore is funded with a small amount of USDC, is:

```bash
cd contracts
arc-forge create src/RequisitionBook.sol:RequisitionBook \
  --rpc-url https://rpc.mainnet.arc.io \
  --account <keystore-name> \
  --constructor-args 0x3600000000000000000000000000000000000000 \
  --broadcast
```

Arc Studio deploys testnet only. Sourcify lists Arc Mainnet as supported; verification has not yet been attempted for this new mainnet contract, so no verification claim is made. The app reads the contract address from `VITE_REQUISITION_BOOK`; the deployment transaction and example batch are configured separately. See [docs/VERIFICATION.md](docs/VERIFICATION.md) for the evidence checklist and current status.

## Security model

- The buyer is the payer and final approver.
- The agent can propose requests but cannot move funds.
- The request digest is marked used before transfer; replay reverts.
- Any field change invalidates the agent signature.
- The contract never holds USDC; direct transfers to it are unrecoverable.
- USDC issuer blocklists can make a transfer revert; a batch is all-or-nothing.
- No independent audit. Use small amounts. This is not production-readiness software.

See [docs/SECURITY.md](docs/SECURITY.md) for the threat model and [docs/LIMITATIONS.md](docs/LIMITATIONS.md) for explicit non-goals.

## Limitations and roadmap

No escrow, dispute, refund, cancellation, delivery proof, fiat, cards, KYC, accounting, or payroll. The purpose text is offchain and visible to anyone with a bundle link; do not put secrets in it. Receipt verification needs a transaction hash supplied by the user. Public RPC availability and browser wallet behavior are external dependencies.

Next: mainnet deployment, one real mainnet batch, public Vercel deployment, Sourcify source verification, and a 90-day roadmap toward approval policies, vendor directories, and accounting exports.

## License

MIT. Copyright (c) 2026 unify.
