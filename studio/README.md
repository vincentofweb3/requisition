# Arc Studio origin

This directory preserves the Arc Studio run and the pulled artifacts. It is supporting evidence, not the mainnet application.

| Fact | Value |
| --- | --- |
| Studio app | `d3a230c9-d4b1-4c08-8cf4-6b018d2e83c0` |
| Studio thread | `98fcb66c-8073-4fc4-96b9-1ec49c788571` |
| Studio web URL | https://studio.arc.io/app/d3a230c9-d4b1-4c08-8cf4-6b018d2e83c0 |
| Testnet preview | https://ir1cfm2pu2r187whim18o.preview.studio.arc.io |
| Testnet contract | `0x578d3006f5a5c34149d5206caac008f544510cbd` |
| Testnet deploy tx | `0xff9d5fce44fa0c1925c9282b7e909e2972f3e6ea74dc537181db7a31a1ba389f` |
| Testnet block | `69402196` |
| Chain | Arc Testnet `5042002` |
| Tests | `75 passed, 0 failed, 0 skipped` |

`STUDIO_PROMPT.md`, `run.json`, and `attach.json` record the prompt and detached run. `pulled/` contains the artifacts returned by `arc-studio pull`; its build caches are ignored. The canonical source and tests used for the public app live in `../contracts/`.

Arc Studio deploys testnet only. Mainnet is a separate, human-approved Arc Foundry deployment; do not present the testnet preview as mainnet evidence.

Raw Studio output in `attach.json` and `pulled/` contains model-generated claims, including an internal “security audit complete” status. Treat that as Studio-generated text, not an independent audit. The project is unaudited.
