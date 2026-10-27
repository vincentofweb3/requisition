// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {RequisitionBook} from "../src/RequisitionBook.sol";
import {ReentrantToken, ReentrantVendor} from "./mocks/Mocks.sol";
import {RequisitionBookTestBase} from "./RequisitionBook.Base.t.sol";

contract RequisitionBookReentrancyTest is RequisitionBookTestBase {
    ReentrantToken internal rtoken;

    bytes4 internal immutable GUARD = ReentrancyGuard.ReentrancyGuardReentrantCall.selector;

    function setUp() public override {
        super.setUp();
        rtoken = new ReentrantToken();
        usdc = rtoken;
        book = new RequisitionBook(IERC20(address(rtoken)));
        rtoken.mint(buyer, BUYER_FUNDS);
        vm.prank(buyer);
        rtoken.approve(address(book), type(uint256).max);
    }

    function _innerPayPayload() internal view returns (bytes memory) {
        RequisitionBook.Requisition memory inner = _req(vendor2, 1e6, bytes32(uint256(777)));
        return abi.encodeCall(book.pay, (inner, _sign(agentPk, inner)));
    }

    function _innerBatchPayload() internal view returns (bytes memory) {
        (RequisitionBook.Requisition[] memory rs, bytes[] memory sigs) = _batch(2, 900);
        return abi.encodeCall(book.payBatch, (rs, sigs));
    }

    function _outer() internal view returns (RequisitionBook.Requisition memory r, bytes memory sig) {
        r = _req(vendor, 10e6, bytes32(uint256(1)));
        sig = _sign(agentPk, r);
    }

    // ------------------------------------------------ malicious token

    function test_Reentrancy_TokenReentersPay_BubblesGuardRevert() public {
        (RequisitionBook.Requisition memory r, bytes memory sig) = _outer();
        rtoken.arm(address(book), _innerPayPayload(), true);
        vm.prank(buyer);
        vm.expectRevert(GUARD);
        book.pay(r, sig);
        assertFalse(book.used(_id(r)));
        assertEq(book.totalPaid(), 0);
        assertEq(rtoken.balanceOf(vendor), 0);
    }

    function test_Reentrancy_TokenReentersPayBatch_BubblesGuardRevert() public {
        (RequisitionBook.Requisition memory r, bytes memory sig) = _outer();
        rtoken.arm(address(book), _innerBatchPayload(), true);
        vm.prank(buyer);
        vm.expectRevert(GUARD);
        book.pay(r, sig);
        assertEq(book.totalPaid(), 0);
    }

    function test_Reentrancy_PayBatchOuter_TokenReentersPay_Reverts() public {
        (RequisitionBook.Requisition[] memory rs, bytes[] memory sigs) = _batch(2, 1);
        rtoken.arm(address(book), _innerPayPayload(), true);
        vm.prank(buyer);
        vm.expectRevert(GUARD);
        book.payBatch(rs, sigs);
        assertEq(book.totalPaid(), 0);
        assertFalse(book.used(_id(rs[0])));
    }

    function test_Reentrancy_PayBatchOuter_TokenReentersPayBatch_Reverts() public {
        (RequisitionBook.Requisition[] memory rs, bytes[] memory sigs) = _batch(2, 1);
        rtoken.arm(address(book), _innerBatchPayload(), true);
        vm.prank(buyer);
        vm.expectRevert(GUARD);
        book.payBatch(rs, sigs);
        assertEq(book.totalPaid(), 0);
    }

    function test_Reentrancy_TokenSwallowsFailure_ReentryStillBlockedAndRecorded() public {
        (RequisitionBook.Requisition memory r, bytes memory sig) = _outer();
        bytes memory innerPayload = _innerPayPayload();
        rtoken.arm(address(book), innerPayload, false);
        vm.prank(buyer);
        book.pay(r, sig);

        assertEq(rtoken.attempts(), 1);
        assertFalse(rtoken.lastOk(), "re-entry must have failed");
        assertEq(rtoken.lastSelector(), GUARD);
        assertEq(book.totalPaid(), 10e6, "only the outer payment settled");
        assertEq(rtoken.balanceOf(vendor), 10e6);
        assertEq(rtoken.balanceOf(vendor2), 0);
        assertEq(rtoken.balanceOf(address(book)), 0);
    }

    // ------------------------------------------------ malicious vendor

    function _armedVendor(bytes memory payload, bool bubble) internal returns (ReentrantVendor v) {
        v = new ReentrantVendor();
        v.arm(address(book), payload, bubble);
        rtoken.setHook(true);
    }

    function test_Reentrancy_VendorContractReentersPay_Reverts() public {
        ReentrantVendor v = _armedVendor(_innerPayPayload(), true);
        RequisitionBook.Requisition memory r = _req(address(v), 10e6, bytes32(uint256(1)));
        bytes memory sig = _sign(agentPk, r);
        vm.prank(buyer);
        vm.expectRevert(GUARD);
        book.pay(r, sig);
        assertFalse(book.used(_id(r)));
        assertEq(rtoken.balanceOf(address(v)), 0);
        assertEq(book.totalPaid(), 0);
    }

    function test_Reentrancy_VendorContractReentersPayBatch_Reverts() public {
        ReentrantVendor v = _armedVendor(_innerBatchPayload(), true);
        RequisitionBook.Requisition memory r = _req(address(v), 10e6, bytes32(uint256(1)));
        bytes memory sig = _sign(agentPk, r);
        vm.prank(buyer);
        vm.expectRevert(GUARD);
        book.pay(r, sig);
        assertEq(book.totalPaid(), 0);
    }

    function test_Reentrancy_VendorContractInBatch_Reverts() public {
        ReentrantVendor v = _armedVendor(_innerPayPayload(), true);
        RequisitionBook.Requisition[] memory rs = new RequisitionBook.Requisition[](2);
        bytes[] memory sigs = new bytes[](2);
        rs[0] = _req(vendor, 10e6, bytes32(uint256(1)));
        rs[1] = _req(address(v), 10e6, bytes32(uint256(2)));
        sigs[0] = _sign(agentPk, rs[0]);
        sigs[1] = _sign(agentPk, rs[1]);
        vm.prank(buyer);
        vm.expectRevert(GUARD);
        book.payBatch(rs, sigs);
        assertEq(book.totalPaid(), 0);
        assertEq(rtoken.balanceOf(vendor), 0);
        assertFalse(book.used(_id(rs[0])));
    }

    function test_Reentrancy_VendorSwallowsFailure_ReentryBlockedOuterSettles() public {
        ReentrantVendor v = _armedVendor(_innerPayPayload(), false);
        RequisitionBook.Requisition memory r = _req(address(v), 10e6, bytes32(uint256(1)));
        bytes memory sig = _sign(agentPk, r);
        vm.prank(buyer);
        book.pay(r, sig);

        assertEq(v.attempts(), 1);
        assertFalse(v.lastOk());
        assertEq(v.lastSelector(), GUARD);
        assertEq(book.totalPaid(), 10e6);
        assertEq(rtoken.balanceOf(address(v)), 10e6);
        assertEq(rtoken.balanceOf(vendor2), 0);
        assertEq(rtoken.balanceOf(address(book)), 0);
    }
}
