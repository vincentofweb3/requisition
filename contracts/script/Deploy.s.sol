// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {RequisitionBook} from "../src/RequisitionBook.sol";

contract Deploy is Script {
    address internal constant ARC_MAINNET_USDC = 0x3600000000000000000000000000000000000000;
    uint256 internal constant ARC_MAINNET_CHAIN_ID = 5042;

    error WrongChain(uint256 chainId);

    function run() external returns (RequisitionBook book) {
        if (block.chainid != ARC_MAINNET_CHAIN_ID) revert WrongChain(block.chainid);
        vm.startBroadcast();
        book = new RequisitionBook(IERC20(ARC_MAINNET_USDC));
        vm.stopBroadcast();
    }
}
