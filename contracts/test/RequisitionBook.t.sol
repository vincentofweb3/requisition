// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {RequisitionBook} from "../src/RequisitionBook.sol";
import {RequisitionBookTestBase} from "./RequisitionBook.Base.t.sol";
import {Mock1271Wallet} from "./mocks/Mocks.sol";

contract RequisitionBookTest is RequisitionBookTestBase {
    // ------------------------------------------------------------ deployment

    function test_Constructor_RevertsOnZeroUsdc() public {
        vm.expectRevert(RequisitionBook.ZeroUsdc.selector);
        new RequisitionBook(IERC20(address(0)));
    }

    function test_Constructor_StoresUsdcAndConstants() public view {
        assertEq(address(book.usdc()), address(usdc));
        assertEq(book.MAX_BATCH(), 50);
        assertEq(book.totalPaid(), 0);
        assertEq(book.REQUISITION_TYPEHASH(), TYPEHASH);
    }

    // ------------------------------------------------------------- happy path

    function test_Pay_HappyPath() public {
        RequisitionBook.Requisition memory r = _req(vendor, 25e6, bytes32(uint256(1)));
        bytes memory sig = _sign(agentPk, r);
        bytes32 id = _id(r);
        uint256 buyerBefore = usdc.balanceOf(buyer);

        vm.expectEmit(true, true, true, true, address(book));
        emit RequisitionBook.RequisitionPaid(id, agent, buyer, vendor, 25e6, PURPOSE, r.expiresAt, r.nonce);
        vm.prank(buyer);
        bytes32 ret = book.pay(r, sig);

        assertEq(ret, id, "returned requestId == digest");
        assertEq(usdc.balanceOf(buyer), buyerBefore - 25e6);
        assertEq(usdc.balanceOf(vendor), 25e6);
        assertEq(usdc.balanceOf(address(book)), 0, "book holds nothing");
        assertTrue(book.used(id));
        assertEq(book.totalPaid(), 25e6);

        RequisitionBook.PaymentRecord memory rec = _record(id);
        assertEq(rec.agent, agent);
        assertEq(rec.buyer, buyer);
        assertEq(rec.vendor, vendor);
        assertEq(rec.amount, 25e6);
        assertEq(rec.purposeHash, PURPOSE);
        assertEq(rec.expiresAt, r.expiresAt);
        assertEq(rec.paidAt, uint64(block.timestamp));
        assertEq(rec.nonce, r.nonce);
    }

    function test_PaidAt_ReflectsSettlementTime() public {
        RequisitionBook.Requisition memory r = _req(vendor, 1e6, bytes32(uint256(2)));
        bytes memory sig = _sign(agentPk, r);
        skip(3 hours);
        vm.prank(buyer);
        bytes32 id = book.pay(r, sig);
        assertEq(_record(id).paidAt, uint64(START + 3 hours));
    }

    function test_HashParity_MatchesIndependentEip712Digest() public view {
        RequisitionBook.Requisition memory r = _req(vendor, 123456, keccak256("n"));
        assertEq(book.hashRequisition(r), _independentDigest(r, block.chainid, address(book)));
    }

    // ---------------------------------------------------------------- buyer

    function test_Pay_RevertsNotBuyer_Stranger() public {
        RequisitionBook.Requisition memory r = _req(vendor, 1e6, bytes32(uint256(3)));
        bytes memory sig = _sign(agentPk, r);
        vm.prank(stranger);
        vm.expectRevert(RequisitionBook.NotBuyer.selector);
        book.pay(r, sig);
    }

    function test_Pay_RevertsNotBuyer_VendorCalling() public {
        RequisitionBook.Requisition memory r = _req(vendor, 1e6, bytes32(uint256(3)));
        bytes memory sig = _sign(agentPk, r);
        vm.prank(vendor);
        vm.expectRevert(RequisitionBook.NotBuyer.selector);
        book.pay(r, sig);
    }

    function test_Pay_RevertsNotBuyer_AgentCalling() public {
        RequisitionBook.Requisition memory r = _req(vendor, 1e6, bytes32(uint256(3)));
        bytes memory sig = _sign(agentPk, r);
        vm.prank(agent);
        vm.expectRevert(RequisitionBook.NotBuyer.selector);
        book.pay(r, sig);
    }

    // ------------------------------------------------------- field validation

    function test_Pay_RevertsZeroAgent() public {
        RequisitionBook.Requisition memory r = _req(vendor, 1e6, bytes32(uint256(4)));
        r.agent = address(0);
        bytes memory sig = _sign(agentPk, r);
        vm.prank(buyer);
        vm.expectRevert(RequisitionBook.ZeroAgent.selector);
        book.pay(r, sig);
    }

    function test_Pay_RevertsZeroVendor() public {
        RequisitionBook.Requisition memory r = _req(address(0), 1e6, bytes32(uint256(4)));
        bytes memory sig = _sign(agentPk, r);
        vm.prank(buyer);
        vm.expectRevert(RequisitionBook.ZeroVendor.selector);
        book.pay(r, sig);
    }

    function test_Pay_RevertsVendorIsContract() public {
        RequisitionBook.Requisition memory r = _req(address(book), 1e6, bytes32(uint256(4)));
        bytes memory sig = _sign(agentPk, r);
        vm.prank(buyer);
        vm.expectRevert(RequisitionBook.VendorIsContract.selector);
        book.pay(r, sig);
    }

    function test_Pay_RevertsZeroAmount() public {
        RequisitionBook.Requisition memory r = _req(vendor, 0, bytes32(uint256(4)));
        bytes memory sig = _sign(agentPk, r);
        vm.prank(buyer);
        vm.expectRevert(RequisitionBook.ZeroAmount.selector);
        book.pay(r, sig);
    }

    function test_Pay_RevertsZeroPurposeHash() public {
        RequisitionBook.Requisition memory r = _req(vendor, 1e6, bytes32(uint256(4)));
        r.purposeHash = bytes32(0);
        bytes memory sig = _sign(agentPk, r);
        vm.prank(buyer);
        vm.expectRevert(RequisitionBook.ZeroPurposeHash.selector);
        book.pay(r, sig);
    }

    function test_Pay_RevertsExpired_AtExactTimestamp() public {
        RequisitionBook.Requisition memory r = _req(vendor, 1e6, bytes32(uint256(5)));
        r.expiresAt = uint64(block.timestamp);
        bytes memory sig = _sign(agentPk, r);
        vm.prank(buyer);
        vm.expectRevert(RequisitionBook.Expired.selector);
        book.pay(r, sig);
    }

    function test_Pay_RevertsExpired_InPast() public {
        RequisitionBook.Requisition memory r = _req(vendor, 1e6, bytes32(uint256(5)));
        r.expiresAt = uint64(block.timestamp - 1);
        bytes memory sig = _sign(agentPk, r);
        vm.prank(buyer);
        vm.expectRevert(RequisitionBook.Expired.selector);
        book.pay(r, sig);
    }

    function test_Pay_SucceedsOneSecondBeforeExpiry() public {
        RequisitionBook.Requisition memory r = _req(vendor, 1e6, bytes32(uint256(5)));
        r.expiresAt = uint64(block.timestamp + 1);
        bytes memory sig = _sign(agentPk, r);
        vm.prank(buyer);
        book.pay(r, sig);
        assertEq(usdc.balanceOf(vendor), 1e6);
    }

    // ----------------------------------------------------------------- replay

    function test_Pay_ReplayRevertsAlreadyUsed() public {
        RequisitionBook.Requisition memory r = _req(vendor, 7e6, bytes32(uint256(6)));
        bytes memory sig = _sign(agentPk, r);
        bytes32 id = _id(r);
        vm.prank(buyer);
        book.pay(r, sig);

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(RequisitionBook.AlreadyUsed.selector, id));
        book.pay(r, sig);
        assertEq(usdc.balanceOf(vendor), 7e6);
        assertEq(book.totalPaid(), 7e6);
    }

    // --------------------------------------------------------------- tampering

    function _signedBase() internal view returns (RequisitionBook.Requisition memory r, bytes memory sig) {
        r = _req(vendor, 10e6, bytes32(uint256(8)));
        sig = _sign(agentPk, r);
    }

    function _expectInvalidSigPay(address caller, RequisitionBook.Requisition memory r, bytes memory sig) internal {
        vm.prank(caller);
        vm.expectRevert(RequisitionBook.InvalidSignature.selector);
        book.pay(r, sig);
        assertEq(book.totalPaid(), 0);
        assertEq(usdc.balanceOf(address(book)), 0);
    }

    function test_Tampered_Agent() public {
        (RequisitionBook.Requisition memory r, bytes memory sig) = _signedBase();
        r.agent = stranger;
        _expectInvalidSigPay(buyer, r, sig);
    }

    function test_Tampered_Buyer_WithoutMatchingCallerRevertsNotBuyer() public {
        (RequisitionBook.Requisition memory r, bytes memory sig) = _signedBase();
        r.buyer = stranger;
        vm.prank(buyer);
        vm.expectRevert(RequisitionBook.NotBuyer.selector);
        book.pay(r, sig);
    }

    function test_Tampered_Buyer_ConsistentWithCallerRevertsInvalidSignature() public {
        (RequisitionBook.Requisition memory r, bytes memory sig) = _signedBase();
        r.buyer = stranger;
        usdc.mint(stranger, 100e6);
        _expectInvalidSigPay(stranger, r, sig);
    }

    function test_Tampered_Vendor() public {
        (RequisitionBook.Requisition memory r, bytes memory sig) = _signedBase();
        r.vendor = stranger;
        _expectInvalidSigPay(buyer, r, sig);
    }

    function test_Tampered_Amount() public {
        (RequisitionBook.Requisition memory r, bytes memory sig) = _signedBase();
        r.amount = r.amount + 1;
        _expectInvalidSigPay(buyer, r, sig);
    }

    function test_Tampered_PurposeHash() public {
        (RequisitionBook.Requisition memory r, bytes memory sig) = _signedBase();
        r.purposeHash = keccak256("something else");
        _expectInvalidSigPay(buyer, r, sig);
    }

    function test_Tampered_ExpiresAt() public {
        (RequisitionBook.Requisition memory r, bytes memory sig) = _signedBase();
        r.expiresAt = r.expiresAt + 1;
        _expectInvalidSigPay(buyer, r, sig);
    }

    function test_Tampered_Nonce() public {
        (RequisitionBook.Requisition memory r, bytes memory sig) = _signedBase();
        r.nonce = bytes32(uint256(9999));
        _expectInvalidSigPay(buyer, r, sig);
    }

    // ------------------------------------------------------------ bad signers

    function test_BadSigner_NonAgentSignature() public {
        RequisitionBook.Requisition memory r = _req(vendor, 10e6, bytes32(uint256(10)));
        bytes memory sig = _sign(otherPk, r);
        _expectInvalidSigPay(buyer, r, sig);
    }

    function test_BadSigner_ShortSignature() public {
        RequisitionBook.Requisition memory r = _req(vendor, 10e6, bytes32(uint256(10)));
        _expectInvalidSigPay(buyer, r, hex"1234");
    }

    function test_BadSigner_EmptySignature() public {
        RequisitionBook.Requisition memory r = _req(vendor, 10e6, bytes32(uint256(10)));
        _expectInvalidSigPay(buyer, r, "");
    }

    function test_BadSigner_Garbage65ByteSignature() public {
        RequisitionBook.Requisition memory r = _req(vendor, 10e6, bytes32(uint256(10)));
        bytes memory garbage = new bytes(65);
        for (uint256 i = 0; i < 65; i++) {
            garbage[i] = bytes1(uint8(0xAB));
        }
        _expectInvalidSigPay(buyer, r, garbage);
    }

    function test_BadSigner_AllZero65ByteSignature() public {
        RequisitionBook.Requisition memory r = _req(vendor, 10e6, bytes32(uint256(10)));
        _expectInvalidSigPay(buyer, r, new bytes(65));
    }

    // --------------------------------------------------- wrong domain signatures

    function test_WrongDomain_DifferentVerifyingContractRejected() public {
        RequisitionBook.Requisition memory r = _req(vendor, 10e6, bytes32(uint256(11)));
        bytes memory sig = _signDigest(agentPk, _independentDigest(r, block.chainid, makeAddr("otherBook")));
        _expectInvalidSigPay(buyer, r, sig);
    }

    function test_WrongDomain_DifferentChainIdRejected() public {
        RequisitionBook.Requisition memory r = _req(vendor, 10e6, bytes32(uint256(11)));
        bytes memory sig = _signDigest(agentPk, _independentDigest(r, block.chainid + 1, address(book)));
        _expectInvalidSigPay(buyer, r, sig);
    }

    function test_WrongDomain_CorrectIndependentDigestIsAccepted() public {
        RequisitionBook.Requisition memory r = _req(vendor, 10e6, bytes32(uint256(11)));
        bytes memory sig = _signDigest(agentPk, _independentDigest(r, block.chainid, address(book)));
        vm.prank(buyer);
        book.pay(r, sig);
        assertEq(usdc.balanceOf(vendor), 10e6);
    }

    function test_WrongDomain_SignatureFromOtherBookInstanceRejected() public {
        RequisitionBook other = new RequisitionBook(IERC20(address(usdc)));
        RequisitionBook.Requisition memory r = _req(vendor, 10e6, bytes32(uint256(11)));
        bytes memory sig = _signDigest(agentPk, other.hashRequisition(r));
        _expectInvalidSigPay(buyer, r, sig);
    }

    // ---------------------------------------------------------------- ERC-1271

    function test_Erc1271Agent_AcceptedWhenWalletApproves() public {
        Mock1271Wallet wallet = new Mock1271Wallet();
        RequisitionBook.Requisition memory r = _req(vendor, 10e6, bytes32(uint256(12)));
        r.agent = address(wallet);
        bytes32 id = _id(r);
        wallet.approveDigest(id);

        vm.prank(buyer);
        bytes32 ret = book.pay(r, hex"01");
        assertEq(ret, id);
        assertEq(usdc.balanceOf(vendor), 10e6);
        assertEq(_record(id).agent, address(wallet));
    }

    function test_Erc1271Agent_RejectedWhenWalletDoesNotApprove() public {
        Mock1271Wallet wallet = new Mock1271Wallet();
        RequisitionBook.Requisition memory r = _req(vendor, 10e6, bytes32(uint256(12)));
        r.agent = address(wallet);
        _expectInvalidSigPay(buyer, r, hex"01");
    }

    function test_Erc1271Agent_ApprovalOfDifferentDigestRejected() public {
        Mock1271Wallet wallet = new Mock1271Wallet();
        RequisitionBook.Requisition memory r = _req(vendor, 10e6, bytes32(uint256(12)));
        r.agent = address(wallet);
        wallet.approveDigest(keccak256("unrelated"));
        _expectInvalidSigPay(buyer, r, hex"01");
    }

    // ------------------------------------------------- no admin / no native funds

    function test_NoOwner_NoWithdraw_NoAdminSurface() public {
        bytes[6] memory calls = [
            abi.encodeWithSignature("owner()"),
            abi.encodeWithSignature("withdraw()"),
            abi.encodeWithSignature("withdraw(address,uint256)"),
            abi.encodeWithSignature("rescue(address,uint256)"),
            abi.encodeWithSignature("transferOwnership(address)", stranger),
            abi.encodeWithSignature("paused()")
        ];
        for (uint256 i = 0; i < calls.length; i++) {
            (bool ok,) = address(book).call(calls[i]);
            assertFalse(ok, "admin-like selector must not exist");
        }
    }

    function test_SendingEthReverts() public {
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        (bool ok,) = address(book).call{value: 1 wei}("");
        assertFalse(ok, "plain ETH transfer must revert");
        vm.prank(stranger);
        (ok,) = address(book).call{value: 1 wei}(hex"deadbeef");
        assertFalse(ok, "ETH with unknown selector must revert");
        assertEq(address(book).balance, 0);
    }

    function test_EthWithPayCallReverts() public {
        RequisitionBook.Requisition memory r = _req(vendor, 1e6, bytes32(uint256(13)));
        bytes memory sig = _sign(agentPk, r);
        vm.deal(buyer, 1 ether);
        vm.prank(buyer);
        (bool ok,) = address(book).call{value: 1 wei}(abi.encodeCall(book.pay, (r, sig)));
        assertFalse(ok, "pay is not payable");
    }

    // -------------------------------------------------------------------- fuzz

    function testFuzz_Pay_AmountAndExpiry(uint128 amount, uint64 expiresAt, uint64 nowTs) public {
        amount = uint128(bound(amount, 1, type(uint128).max));
        nowTs = uint64(bound(nowTs, 1, type(uint64).max - 1));
        vm.warp(nowTs);
        usdc.mint(buyer, amount);

        RequisitionBook.Requisition memory r = _req(vendor, amount, keccak256(abi.encode(amount, expiresAt)));
        r.expiresAt = expiresAt;
        bytes memory sig = _sign(agentPk, r);
        bytes32 id = _id(r);
        uint256 buyerBefore = usdc.balanceOf(buyer);

        vm.prank(buyer);
        if (expiresAt <= nowTs) {
            vm.expectRevert(RequisitionBook.Expired.selector);
            book.pay(r, sig);
            assertFalse(book.used(id));
            assertEq(book.totalPaid(), 0);
        } else {
            assertEq(book.pay(r, sig), id);
            assertEq(usdc.balanceOf(buyer), buyerBefore - amount);
            assertEq(usdc.balanceOf(vendor), amount);
            assertEq(usdc.balanceOf(address(book)), 0);
            assertEq(book.totalPaid(), amount);
            assertEq(_record(id).paidAt, nowTs);
        }
    }

    function testFuzz_Pay_HashParity(
        address a,
        address b,
        address v,
        uint128 amount,
        bytes32 ph,
        uint64 exp,
        bytes32 nonce
    ) public view {
        RequisitionBook.Requisition memory r = RequisitionBook.Requisition(a, b, v, amount, ph, exp, nonce);
        assertEq(book.hashRequisition(r), _independentDigest(r, block.chainid, address(book)));
    }
}
