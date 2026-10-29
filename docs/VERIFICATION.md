# Verification

Status as of 2026-10-28. This file distinguishes testnet supporting evidence from the required mainnet evidence.

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

- Public testnet preview: https://requisition-arc.vercel.app. A logged-out Playwright pass loaded Home, Desk, Proof, Docs, and mobile Home with no page or console errors on 2026-10-29. The Desk showed a fresh two-request bundle as READY. This is a testnet build; the mainnet build is redeployed after deployment.

| Check | Result |
| --- | --- |
| App unit tests | 18 passed |
| App typecheck | Passed |
| App ESLint | Passed |
| Vite production build | Passed |
| Browser smoke test | Home, Desk, Proof, Docs, and mobile Home rendered with no page errors |
| CLI create/batch | Signed 1- and 2-request bundles |
| CLI show/link | Parsed and encoded the bundles |
| CLI verify against testnet RPC | Both request digests matched `hashRequisition` |
| Testnet payment made through app | No; Proof intentionally shows `0 USDC` paid |

## Mainnet evidence

**Not deployed. No mainnet transaction exists.**

Required before submission:

- [x] Human approves public repository.
- [ ] Human approves mainnet deployment.
- [ ] Human-controlled keystore funded with a small amount of Arc mainnet USDC.
- [ ] `RequisitionBook` deployed to chain `5042` with USDC `0x3600000000000000000000000000000000000000`.
- [ ] Contract code read back from mainnet.
- [ ] Deployment tx and block recorded in `contracts/deployments/arc-mainnet.json`.
- [ ] Public app built with the mainnet contract address.
- [ ] Real buyer wallet pays a two-vendor batch through the public app.
- [ ] Explorer shows the transaction and both USDC transfers.
- [ ] Contract balance is `0` after settlement.
- [ ] Vendor balance deltas and `RequisitionPaid` events recorded.
- [ ] Receipt page verifies the transaction.
- [ ] Source verification attempted and its actual result recorded.

Do not change this file to claim mainnet evidence until every item above is true and independently checked.

## Network checks

Checked on 2026-10-27 without spending funds:

| Check | Result |
| --- | --- |
| Arc mainnet `eth_chainId` | `0x13b2` = `5042` |
| Arc testnet `eth_chainId` | `0x4cef52` = `5042002` |
| Mainnet USDC code | Present at `0x3600000000000000000000000000000000000000` |
| Mainnet RPC CORS | Preflight and POST allow the planned Vercel origin |
| Sourcify Arc support | Chain `5042` is listed as supported; the explorer endpoint responds |

The CORS check used `https://requisition-arc.vercel.app` as the `Origin`; the final Vercel origin must be checked again after deployment. A CORS response is not proof that the public RPC will remain available.

## Studio access

`https://studio.arc.io/app/d3a230c9-d4b1-4c08-8cf4-6b018d2e83c0` redirects to Circle login when requested without a session. The public testnet preview is reachable. The submission should include both URLs, and the Studio project sharing/login requirement should be checked before submitting.

## Source verification

Sourcify lists Arc Mainnet (`5042`) as supported, and the Arc explorer endpoint responds. No new mainnet contract has been submitted for verification yet. The app and README therefore say `unverified`; they do not claim a verified contract.

After mainnet deployment, the intended command is:

```bash
cd contracts
arc-forge verify-contract <address> src/RequisitionBook.sol:RequisitionBook \
  --verifier sourcify --chain 5042 --watch \
  --constructor-args $(arc-cast abi-encode "constructor(address)" 0x3600000000000000000000000000000000000000)
```

Record the actual result. If Sourcify rejects the submission, say so; do not substitute an explorer label.
