# Limitations

- No independent audit and no production-readiness claim.
- No escrow, dispute resolution, refund, cancellation, or delivery proof.
- A signed request cannot be revoked onchain; it stays payable until expiry.
- The purpose text is offchain and visible to anyone with a bundle link. Do not put secrets in it.
- The contract stores a purpose hash, not the purpose text.
- Receipt verification requires a transaction hash supplied by the user.
- Public RPC availability, rate limits, and browser wallet behavior are external dependencies.
- USDC issuer blocklists can make a payment or a whole batch revert.
- Direct USDC transfers to the contract are unrecoverable; there is no admin.
- ERC-6492 counterfactual smart-account signatures are not supported; deployed ERC-1271 accounts are.
- Batch settlement is atomic, not partial.
- No fiat, cards, KYC, accounting, payroll, bank, or delivery integration.
- The Studio testnet deployment is not mainnet evidence.
