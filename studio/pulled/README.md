# Requisition

An AI agent signs purchase requests; a human buyer opens a link, verifies each request in the browser, and pays one or a batch in USDC on Arc Testnet. USDC goes directly from the buyer to the vendor. The contract never holds funds and has no admin, fees or upgrade path.

Built with [Arc Studio](https://studio.arc.io)

## Pages

- Home: what it is and how it works, plus a box to open a bundle.
- Desk: opens a bundle link, checks every request, lets the buyer select requests, approve the exact total and pay.
- Receipt: shows a payment recorded by the contract and checks a transaction against it.
- Proof: live contract facts, event history and limitations.
- Docs: bundle format, security model and limitations.

## Tech stack

- Vite, React, TypeScript, Tailwind CSS
- wagmi and viem with an injected browser wallet
- Solidity 0.8.28, OpenZeppelin, Foundry
- Arc Testnet (chain id 5042002), USDC (6 decimals)

## Development

Prerequisites: [Bun](https://bun.sh) and [Foundry](https://book.getfoundry.sh).

```bash
bun install
bun run dev
```

Build the app, run the checks and the contract tests:

```bash
bunx vite build
bun run check
bun run contracts:test
```

### Environment variables

Set these in `.env`. None of them is a secret.

- `VITE_REQUISITION_BOOK_ADDRESS`: address of the deployed RequisitionBook contract.
- `VITE_REQUISITION_BOOK_DEPLOY_BLOCK`: block the contract was deployed in. The Proof page scans events from here.
- `VITE_REQUISITION_BOOK_DEPLOY_TX`: deployment transaction hash shown on the Proof page.
- `VITE_STUDIO_WEB_URL`: optional public URL of the published app, shown on the Proof page.

For the agent-side script only (set in your shell, never commit):

- `AGENT_PRIVATE_KEY`: key of the agent that signs requests.
- `APP_URL`: optional base URL used to print the bundle link.

### Creating a bundle

Write a JSON array of `{ buyer, vendor, amount, purpose, ttlSeconds }` (amount in USDC such as `"12.50"`), then:

```bash
AGENT_PRIVATE_KEY=0x... APP_URL=https://your-app bun run bundle:create requests.json
```

## Limitations

Testnet only. No third-party audit. A signed request cannot be cancelled before it expires. See the Docs page in the app.
