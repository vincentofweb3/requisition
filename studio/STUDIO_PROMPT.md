Build a production-quality Arc testnet dApp called Requisition.

Purpose: an AI agent creates an EIP-712 signed purchase request; a human buyer opens a link, verifies it, and pays one or a batch. USDC moves directly from buyer to vendor. The contract never holds funds, has no admin, no fees, no upgrade.

Network: Arc testnet, chain ID 5042002, RPC https://rpc.testnet.arc.io, explorer https://explorer.testnet.arc.io, USDC ERC-20 0x3600000000000000000000000000000000000000 (6 decimals). USDC is gas. Do not deploy mainnet.

Contracts:
- RequisitionBook.sol, Solidity 0.8.x, OpenZeppelin.
- struct Requisition { address agent; address buyer; address vendor; uint128 amount; bytes32 purposeHash; uint64 expiresAt; bytes32 nonce; }
- struct PaymentRecord { address agent; address buyer; address vendor; uint128 amount; bytes32 purposeHash; uint64 expiresAt; uint64 paidAt; bytes32 nonce; }
- EIP-712 domain name "RequisitionBook", version "1", chainId, verifyingContract.
- type string: Requisition(address agent,address buyer,address vendor,uint128 amount,bytes32 purposeHash,uint64 expiresAt,bytes32 nonce)
- mappings used, records; uint256 totalPaid; uint256 constant MAX_BATCH=50; IERC20 immutable usdc.
- hashRequisition(Requisition) view returns digest.
- pay(Requisition,bytes signature) returns requestId.
- payBatch(Requisition[],bytes[] signatures) returns requestIds; atomic; max 50.
- event RequisitionPaid(bytes32 indexed requestId,address indexed agent,address indexed buyer,address vendor,uint256 amount,bytes32 purposeHash,uint64 expiresAt,bytes32 nonce).
- Validation: msg.sender==buyer; agent/vendor nonzero; vendor != contract; amount>0; purposeHash nonzero; expiresAt>block.timestamp; not used; signature valid for agent; batch lengths equal/nonempty/cap.
- Effects: mark used, write record, totalPaid, safeTransferFrom buyer->vendor, emit. NonReentrant, SafeERC20, checks-effects-interactions.
- No owner/admin/upgrade/fees/custody. Do not add withdraw/refund/cancel.
- Foundry tests: happy path, hash parity, buyer mismatch, zero address/amount/purpose, expired, replay, tampered fields, bad signer, batch happy/empty/mismatch/duplicate/over cap/atomic revert, allowance/balance, mock blocklist, reentrancy, invariant contract balance 0 and totalPaid sum.

App: Vite + React + TypeScript + wagmi + viem, no backend.
- Home: pitch, how it works, open bundle, proof link.
- Desk: decode bundle from URL fragment #b=base64url JSON; verify EIP-712 signatures with viem verifyTypedData; check chain/contract/purpose hash/expiry/buyer; read used/records; show agent, vendor, amount, purpose, expiry; select requests; show total; approve exact USDC; payBatch; show tx hash/explorer/receipts.
- Receipt /r/:requestId?tx=...: read records; if tx, fetch receipt and verify RequisitionPaid log; show explorer link.
- Proof: contract, USDC, chain, Studio URL placeholder, real testnet evidence, totalPaid, contract balance 0, limitations.
- Docs: schema, security, limitations.
- Bundle caps 50 requests, 280 chars purpose. Amounts are 6-decimal base-unit strings. Purpose hash must match keccak256(toBytes(purpose)).
- No infinite approval. No fake data. No seed phrase. Injected wallet only. Show clear errors.

Tests: Foundry tests pass; app builds. Provide testnet deployment address, preview URL, Studio webUrl, and test output.

Do not deploy mainnet. Do not add escrow/custody/admin/fees. Do not claim audits or users.
