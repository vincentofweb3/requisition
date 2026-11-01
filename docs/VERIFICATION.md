# Verification

Status as of 2026-11-01. This file distinguishes testnet supporting evidence from the required mainnet evidence.

## Public source

Public repo: https://github.com/vincentofweb3/requisition. A clean clone with `--recurse-submodules` passed all 75 Foundry tests on 2026-10-28.

## Arc Studio testnet

| Check | Value |
| --- | --- |
| Studio project | https://studio.arc.io/app/d3a230c9-d4b1-4c08-8cf4-6b018d2e83c0 |
| Studio preview | https://ir1cfm2pu2r187whim18o.preview.studio.arc.io |
| Chain | Arc Testnet, ID `5042002` |
| RequisitionBook | `0x578d3006f5a5c34149d5206caac008f544510cbd` |
| Deployment tx | `0xff9d5fce44fa0c1925c9282b7e909e2972f3e6ea74dc537181db7a31a1ba389f` |
| Deployment block | `69402196` |
| Explorer | https://explorer.testnet.arc.io/address/0x578d3006f5a5c34149d5206caac008f544510cbd |
| Studio test output | `75 passed, 0 failed, 0 skipped` |
| Local Foundry rerun | `75 passed, 0 failed, 0 skipped` |
| USDC readback | `0x3600000000000000000000000000000000000000` |
| MAX_BATCH readback | `50` |
| Code readback | Non-empty bytecode at the address |

The Studio deployment was created through the platform deployer. The deployer has no special rights in the contract. The constructor argument is the Arc USDC ERC-20 address above.

## App and CLI checks

- Public mainnet app: https://requisition-arc.vercel.app. The app loaded logged out and completed a real app-originated USDC batch in a Playwright-driven EIP-1193 wallet on 2026-11-01. The wallet connected, approved the exact total, and the app called `payBatch`.
- Public testnet preview: the Studio preview URL above. The testnet build remains supporting evidence only.

| Check | Result |
| --- | --- |
| App unit tests | 18 passed |
| App typecheck | Passed |
| App ESLint | Passed |
| Vite production build | Passed |
| Mainnet app loaded logged out | Passed |
| Browser smoke test | Home, Desk, Proof, Docs, and mobile Home loaded with no page or console errors |
| Mainnet app payment through app UI | Passed; tx `0x82487b9daeb8d861363b4296da80623fbb5d30127572cef1d5b24d255d681494` |
| Public proof page | Loaded logged out; complete batch evidence shown |
| Public receipt verification | Both request receipts verified against the tx |
| CLI create/batch | Signed 1- and 2-request bundles |
| CLI show/link | Parsed and encoded the bundles |
| CLI verify against testnet RPC | Both request digests matched `hashRequisition` |
| Testnet payment made through app | No; the testnet proof intentionally shows `0 USDC` paid |

## Mainnet evidence

| Check | Value |
| --- | --- |
| RequisitionBook | `0xfC691D4b662cB459b86c353DdA018a7a3b983631` |
| Chain | Arc mainnet, `5042` |
| Deployment tx | `0xa81d4f9a6dea9d3eee0b4a40295553baf95e696d377732c8f31275f4458945b7` |
| Deployment block | `28841314` |
| USDC readback | `0x3600000000000000000000000000000000000000` |
| MAX_BATCH readback | `50` |
| totalPaid readback | `30000` base units = `0.03 USDC` |
| Contract USDC balance | `0` |
| Code readback | non-empty onchain bytecode |
| Source verification | Sourcify: exact match |
| Explorer | https://explorer.arc.io/address/0xfc691d4b662cb459b86c353dda018a7a3b983631 |
| App-originated batch tx | `0x82487b9daeb8d861363b4296da80623fbb5d30127572cef1d5b24d255d681494` |
| App batch block | `29016246` |
| App approval tx | `0x73a5f83c3ca96b928492650010b52a81f82f0a6420df49675b6609f8396a07f1` |

### App-originated mainnet batch

The example batch was submitted through the public app, not a direct CLI send. It moved `0.01 USDC` from the buyer to two vendors atomically.

| Field | Value |
| --- | --- |
| Request 1 | `0xb8d1544ae7d5bbac14294479a57ecefa2843204f583206fb6bb955128fbddc07` |
| Request 2 | `0x4dd02fafe0b66b3363e5ea888f41ef8e156093e906184ccfbe2f937783804953` |
| Vendor 1 | `0x8D04BE649cE1521e31aa93b1923E5ee35475021e`; `0.005 USDC`; balance `10000 -> 15000` |
| Vendor 2 | `0x7aEDE5D09A4142BBCCE639D88614C237bf5436b5`; `0.005 USDC`; balance `10000 -> 15000` |
| Contract balance after | `0` |
| totalPaid after | `30000` base units = `0.03 USDC` |
| Events | `RequisitionPaid` for both request IDs; USDC `Transfer` from buyer to each vendor |

An earlier CLI-sent batch also settled `0.02 USDC` in tx `0x99c63fcae9696a709d678540dc3d7e186c83d434b5f7d8f62ec46c2fce22cf31`. The app-originated batch above is the primary submission example.

## Network checks

Checked on 2026-10-27 and re-exercised on 2026-11-01:

| Check | Result |
| --- | --- |
| Arc mainnet `eth_chainId` | `0x13b2` = `5042` |
| Arc testnet `eth_chainId` | `0x4cef52` = `5042002` |
| Mainnet USDC code | Present at `0x3600000000000000000000000000000000000000` |
| Mainnet RPC from Vercel origin | The live app read state and submitted the example batch |
| Sourcify Arc support | Chain `5042` is listed as supported; the mainnet source is an exact match |

## Studio access

`https://studio.arc.io/app/d3a230c9-d4b1-4c08-8cf4-6b018d2e83c0` redirects to Circle login when requested without a session. The public testnet preview is reachable. The submission should include both URLs, and the Studio project sharing/login requirement should be checked before submitting.

## Source verification

The mainnet contract is recorded as Sourcify-verified with an exact match in `contracts/deployments/arc-mainnet.json` (checked 2026-10-30). The app and README claim only that result. The verification command used was:

```bash
cd contracts
arc-forge verify-contract 0xfC691D4b662cB459b86c353DdA018a7a3b983631 src/RequisitionBook.sol:RequisitionBook \
  --verifier sourcify --chain 5042 --watch \
  --constructor-args $(arc-cast abi-encode "constructor(address)" 0x3600000000000000000000000000000000000000)
```
