# Demo script

Target length: 2:20-2:50.

1. **Hook**: Agents can decide to buy, but a funded agent wallet creates custody risk. Show the Requisition home page.
2. **Studio**: Open the Arc Studio project and the testnet preview. State clearly that Studio produced the contract, tests, and app on testnet.
3. **Contract**: Show `contracts/src/RequisitionBook.sol` and the 75-test output. Point out direct buyer-to-vendor transfer and no admin.
4. **CLI**: Run `req batch` with three requests, two vendors. Show the printed request IDs and bundle link without exposing the key.
5. **Buyer desk**: Open the bundle. Show the signature, purpose hashes, expiry, buyer check, and exact total.
6. **Mainnet**: Switch to the mainnet build, connect the funded buyer wallet, approve the exact total, and pay.
7. **Explorer**: Open the transaction. Show `RequisitionPaid`, the USDC transfer to each vendor, and the contract balance remaining `0`.
8. **Receipt**: Open a receipt with `?tx=` and show the matching event check.
9. **Proof**: Show `totalPaid`, vendor deltas, and that the testnet artifact is labeled supporting evidence.
10. **Close**: Studio URL, public repo, app URL, and the roadmap.

Preflight: public app logged out; mainnet contract code; funded buyer wallet; two vendor addresses; short expiries; no secrets on screen; explorer links open.
