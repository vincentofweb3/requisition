# Security model

## Roles

- **Agent**: holds a signing key with no funds. It can create EIP-712 requests. It cannot pay them.
- **Buyer**: the only address allowed to submit its requests and the only source of USDC.
- **Vendor**: receives USDC directly from the buyer.
- **Contract**: verifies the agent signature, buyer, expiry, replay status, and amount; it never takes custody.

## Invariants

- Contract USDC balance is zero after every settlement.
- `totalPaid` equals the sum of recorded payment amounts.
- A request digest can settle only once.
- A batch is atomic: any failure reverts every transfer and record in the batch.
- No owner, admin, role, upgrade, pause, fee, refund, cancel, or rescue function exists.

## Threats

| Threat | Mitigation |
| --- | --- |
| Replay | The EIP-712 digest is marked used before transfer. |
| Tampering | Changing agent, buyer, vendor, amount, purpose hash, expiry, or nonce invalidates the signature. |
| Wrong chain or contract | Domain binds chain ID and verifying contract; the app checks both. |
| Stranger pays or triggers | `msg.sender` must equal the named buyer. |
| Compromised agent | The attacker can create requests but cannot move buyer funds; the buyer must approve. |
| Phishing | The app shows agent, vendor, amount, purpose, expiry, and request ID before payment. Delivery is not proven. |
| Reentrancy | `ReentrancyGuard` plus effects-before-transfer; the token is trusted to be USDC. |
| USDC blocklist | A blocklisted address can make a transfer revert; the whole batch reverts. |
| Expired request | `expiresAt <= block.timestamp` reverts. Short expiries are recommended. |
| Direct transfer to contract | Unrecoverable; there is no admin or rescue. |

## Key handling

The agent key is read from an environment variable or a local key file and is never accepted as a command-line argument. It is never printed by the CLI. The buyer key stays in the browser wallet. No private key, seed phrase, or token belongs in the repository, app, bundle, screenshots, or video.

## Limits

This contract has not been independently audited. USDC is centrally issued and can be blocked. The purpose is stored offchain as a hash and may be exposed by a bundle link. The app depends on a public RPC and a browser wallet. Payment proves authorization and settlement, not delivery.
