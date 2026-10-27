// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {RequisitionBook} from "../RequisitionBook.sol";
import {MockUSDC} from "./mocks/Mocks.sol";
import {RequisitionBookTestBase} from "./RequisitionBook.Base.t.sol";

contract RequisitionBookBatchTest is RequisitionBookTestBase {
    function _assertNothingChanged(RequisitionBook.Requisition[] memory rs, uint256 buyerBefore) internal view {
        assertEq(usdc.balanceOf(buyer), buyerBefore, "buyer balance unchanged");
        assertEq(usdc.balanceOf(vendor), 0);
        assertEq(usdc.balanceOf(vendor2), 0);
        assertEq(usdc.balanceOf(vendor3), 0);
        assertEq(usdc.balanceOf(address(book)), 0);
        assertEq(book.totalPaid(), 0, "totalPaid unchanged");
        for (uint256 i = 0; i < rs.length; i++) {
            assertFalse(book.used(_id(rs[i])), "used unchanged");
        }
    }

    function test_PayBatch_HappyPath_ThreeRequests() public {
        RequisitionBook.Requisition[] memory rs = new RequisitionBook.Requisition[](3);
        bytes[] memory sigs = new bytes[](3);
        rs[0] = _req(vendor, 10e6, bytes32(uint256(1)));
        rs[1] = _req(vendor2, 20e6, bytes32(uint256(2)));
        rs[2] = _req(vendor3, 30e6, bytes32(uint256(3)));
        bytes32[3] memory ids;
        for (uint256 i = 0; i < 3; i++) {
            sigs[i] = _sign(agentPk, rs[i]);
            ids[i] = _id(rs[i]);
        }
        uint256 buyerBefore = usdc.balanceOf(buyer);

        for (uint256 i = 0; i < 3; i++) {
            vm.expectEmit(true, true, true, true, address(book));
            emit RequisitionBook.RequisitionPaid(
                ids[i], agent, buyer, rs[i].vendor, rs[i].amount, PURPOSE, rs[i].expiresAt, rs[i].nonce
            );
        }
        vm.prank(buyer);
        bytes32[] memory out = book.payBatch(rs, sigs);

        assertEq(out.length, 3);
        for (uint256 i = 0; i < 3; i++) {
            assertEq(out[i], ids[i], "ids in input order");
            assertTrue(book.used(ids[i]));
            assertEq(_record(ids[i]).paidAt, uint64(block.timestamp));
        }
        assertEq(usdc.balanceOf(vendor), 10e6);
        assertEq(usdc.balanceOf(vendor2), 20e6);
        assertEq(usdc.balanceOf(vendor3), 30e6);
        assertEq(usdc.balanceOf(buyer), buyerBefore - 60e6);
        assertEq(usdc.balanceOf(address(book)), 0);
        assertEq(book.totalPaid(), 60e6);
    }

    function test_PayBatch_RevertsEmptyBatch() public {
        RequisitionBook.Requisition[] memory rs = new RequisitionBook.Requisition[](0);
        bytes[] memory sigs = new bytes[](0);
        vm.prank(buyer);
        vm.expectRevert(RequisitionBook.EmptyBatch.selector);
        book.payBatch(rs, sigs);
    }

    function test_PayBatch_RevertsLengthMismatch_MoreRequests() public {
        (RequisitionBook.Requisition[] memory rs, bytes[] memory sigs) = _batch(2, 1);
        bytes[] memory shortSigs = new bytes[](1);
        shortSigs[0] = sigs[0];
        vm.prank(buyer);
        vm.expectRevert(RequisitionBook.LengthMismatch.selector);
        book.payBatch(rs, shortSigs);
    }

    function test_PayBatch_RevertsLengthMismatch_MoreSignatures() public {
        (RequisitionBook.Requisition[] memory rs, bytes[] memory sigs) = _batch(2, 1);
        RequisitionBook.Requisition[] memory shortRs = new RequisitionBook.Requisition[](1);
        shortRs[0] = rs[0];
        vm.prank(buyer);
        vm.expectRevert(RequisitionBook.LengthMismatch.selector);
        book.payBatch(shortRs, sigs);
    }

    function test_PayBatch_DuplicateInsideBatchRevertsWholeBatch() public {
        RequisitionBook.Requisition[] memory rs = new RequisitionBook.Requisition[](3);
        bytes[] memory sigs = new bytes[](3);
        rs[0] = _req(vendor, 10e6, bytes32(uint256(1)));
        rs[1] = _req(vendor2, 10e6, bytes32(uint256(2)));
        rs[2] = rs[0];
        sigs[0] = _sign(agentPk, rs[0]);
        sigs[1] = _sign(agentPk, rs[1]);
        sigs[2] = sigs[0];
        bytes32 dupId = _id(rs[0]);
        uint256 buyerBefore = usdc.balanceOf(buyer);

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(RequisitionBook.AlreadyUsed.selector, dupId));
        book.payBatch(rs, sigs);
        _assertNothingChanged(rs, buyerBefore);
    }

    function test_PayBatch_OverCap_51_RevertsBatchTooLarge() public {
        (RequisitionBook.Requisition[] memory rs, bytes[] memory sigs) = _batch(51, 1);
        vm.prank(buyer);
        vm.expectRevert(RequisitionBook.BatchTooLarge.selector);
        book.payBatch(rs, sigs);
        assertEq(book.totalPaid(), 0);
    }

    function test_PayBatch_Exactly50Succeeds() public {
        (RequisitionBook.Requisition[] memory rs, bytes[] memory sigs) = _batch(50, 1);
        vm.prank(buyer);
        bytes32[] memory ids = book.payBatch(rs, sigs);
        assertEq(ids.length, 50);
        assertEq(book.totalPaid(), 500e6);
        assertEq(usdc.balanceOf(address(book)), 0);
        assertEq(usdc.balanceOf(vendor) + usdc.balanceOf(vendor2) + usdc.balanceOf(vendor3), 500e6);
        assertTrue(book.used(ids[49]));
    }

    function test_PayBatch_AtomicRevert_LastItemInvalidSignature() public {
        (RequisitionBook.Requisition[] memory rs, bytes[] memory sigs) = _batch(3, 1);
        sigs[2] = _sign(otherPk, rs[2]);
        uint256 buyerBefore = usdc.balanceOf(buyer);
        vm.prank(buyer);
        vm.expectRevert(RequisitionBook.InvalidSignature.selector);
        book.payBatch(rs, sigs);
        _assertNothingChanged(rs, buyerBefore);
    }

    function test_PayBatch_AtomicRevert_LastItemExpired() public {
        (RequisitionBook.Requisition[] memory rs, bytes[] memory sigs) = _batch(3, 1);
        rs[2].expiresAt = uint64(block.timestamp);
        sigs[2] = _sign(agentPk, rs[2]);
        uint256 buyerBefore = usdc.balanceOf(buyer);
        vm.prank(buyer);
        vm.expectRevert(RequisitionBook.Expired.selector);
        book.payBatch(rs, sigs);
        _assertNothingChanged(rs, buyerBefore);
    }

    function test_PayBatch_AtomicRevert_ItemNamesDifferentBuyer() public {
        (RequisitionBook.Requisition[] memory rs, bytes[] memory sigs) = _batch(3, 1);
        rs[1].buyer = stranger;
        sigs[1] = _sign(agentPk, rs[1]);
        uint256 buyerBefore = usdc.balanceOf(buyer);
        vm.prank(buyer);
        vm.expectRevert(RequisitionBook.NotBuyer.selector);
        book.payBatch(rs, sigs);
        _assertNothingChanged(rs, buyerBefore);
    }

    function test_PayBatch_AlreadyUsedFromEarlierPayReverts() public {
        (RequisitionBook.Requisition[] memory rs, bytes[] memory sigs) = _batch(2, 1);
        vm.prank(buyer);
        book.pay(rs[1], sigs[1]);
        bytes32 id1 = _id(rs[1]);
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(RequisitionBook.AlreadyUsed.selector, id1));
        book.payBatch(rs, sigs);
        assertEq(book.totalPaid(), 10e6);
        assertFalse(book.used(_id(rs[0])));
    }

    // ------------------------------------------------- allowance / balance

    function test_Pay_RevertsInsufficientAllowance() public {
        vm.prank(buyer);
        usdc.approve(address(book), 5e6);
        RequisitionBook.Requisition memory r = _req(vendor, 10e6, bytes32(uint256(1)));
        bytes memory sig = _sign(agentPk, r);
        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(book), 5e6, 10e6)
        );
        book.pay(r, sig);
        assertFalse(book.used(_id(r)));
        assertEq(book.totalPaid(), 0);
    }

    function test_Pay_RevertsInsufficientBalance() public {
        address poor = makeAddr("poor");
        usdc.mint(poor, 5e6);
        vm.prank(poor);
        usdc.approve(address(book), type(uint256).max);
        RequisitionBook.Requisition memory r = _reqFor(poor, vendor, 10e6, bytes32(uint256(1)));
        bytes memory sig = _sign(agentPk, r);
        vm.prank(poor);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, poor, 5e6, 10e6));
        book.pay(r, sig);
        assertFalse(book.used(_id(r)));
        assertEq(book.totalPaid(), 0);
    }

    function test_PayBatch_InsufficientAllowance_RevertsWholeBatch() public {
        vm.prank(buyer);
        usdc.approve(address(book), 25e6); // covers two of three 10e6 items
        (RequisitionBook.Requisition[] memory rs, bytes[] memory sigs) = _batch(3, 1);
        uint256 buyerBefore = usdc.balanceOf(buyer);
        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(book), 5e6, 10e6)
        );
        book.payBatch(rs, sigs);
        _assertNothingChanged(rs, buyerBefore);
        assertEq(usdc.allowance(buyer, address(book)), 25e6, "allowance restored");
    }

    function test_PayBatch_InsufficientBalance_RevertsWholeBatch() public {
        address poor = makeAddr("poor");
        usdc.mint(poor, 15e6); // covers one of two 10e6 items
        vm.prank(poor);
        usdc.approve(address(book), type(uint256).max);
        RequisitionBook.Requisition[] memory rs = new RequisitionBook.Requisition[](2);
        bytes[] memory sigs = new bytes[](2);
        rs[0] = _reqFor(poor, vendor, 10e6, bytes32(uint256(1)));
        rs[1] = _reqFor(poor, vendor2, 10e6, bytes32(uint256(2)));
        sigs[0] = _sign(agentPk, rs[0]);
        sigs[1] = _sign(agentPk, rs[1]);
        vm.prank(poor);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, poor, 5e6, 10e6));
        book.payBatch(rs, sigs);
        assertEq(usdc.balanceOf(poor), 15e6);
        assertEq(usdc.balanceOf(vendor), 0);
        assertEq(book.totalPaid(), 0);
        assertFalse(book.used(_id(rs[0])));
        assertFalse(book.used(_id(rs[1])));
    }

    // ----------------------------------------------------------- blocklist

    function test_Pay_RevertsWhenVendorBlocklisted_StateUnchanged() public {
        usdc.setBlocklisted(vendor, true);
        RequisitionBook.Requisition memory r = _req(vendor, 10e6, bytes32(uint256(1)));
        bytes memory sig = _sign(agentPk, r);
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(MockUSDC.Blocklisted.selector, vendor));
        book.pay(r, sig);
        assertFalse(book.used(_id(r)));
        assertEq(book.totalPaid(), 0);
        assertEq(usdc.balanceOf(buyer), BUYER_FUNDS);
        assertEq(_record(_id(r)).paidAt, 0, "no record written");
    }

    function test_Pay_RevertsWhenBuyerBlocklisted_StateUnchanged() public {
        usdc.setBlocklisted(buyer, true);
        RequisitionBook.Requisition memory r = _req(vendor, 10e6, bytes32(uint256(1)));
        bytes memory sig = _sign(agentPk, r);
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(MockUSDC.Blocklisted.selector, buyer));
        book.pay(r, sig);
        assertFalse(book.used(_id(r)));
        assertEq(book.totalPaid(), 0);
    }

    function test_PayBatch_BlocklistedVendorInLastItem_RevertsWholeBatch() public {
        usdc.setBlocklisted(vendor3, true);
        (RequisitionBook.Requisition[] memory rs, bytes[] memory sigs) = _batch(3, 1);
        uint256 buyerBefore = usdc.balanceOf(buyer);
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(MockUSDC.Blocklisted.selector, vendor3));
        book.payBatch(rs, sigs);
        _assertNothingChanged(rs, buyerBefore);
    }

    function test_Pay_SucceedsAfterVendorUnblocked() public {
        usdc.setBlocklisted(vendor, true);
        RequisitionBook.Requisition memory r = _req(vendor, 10e6, bytes32(uint256(1)));
        bytes memory sig = _sign(agentPk, r);
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(MockUSDC.Blocklisted.selector, vendor));
        book.pay(r, sig);
        usdc.setBlocklisted(vendor, false);
        vm.prank(buyer);
        book.pay(r, sig);
        assertEq(usdc.balanceOf(vendor), 10e6);
    }
}
