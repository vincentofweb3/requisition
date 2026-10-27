// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {RequisitionBook} from "../RequisitionBook.sol";
import {MockUSDC} from "./mocks/Mocks.sol";

abstract contract RequisitionBookTestBase is Test {
    RequisitionBook internal book;
    MockUSDC internal usdc;

    uint256 internal agentPk;
    address internal agent;
    uint256 internal otherPk;
    address internal otherSigner;

    address internal buyer = makeAddr("buyer");
    address internal vendor = makeAddr("vendor");
    address internal vendor2 = makeAddr("vendor2");
    address internal vendor3 = makeAddr("vendor3");
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant PURPOSE = keccak256("office supplies");
    uint256 internal constant START = 1_700_000_000;
    uint256 internal constant BUYER_FUNDS = 1_000_000e6;

    bytes32 internal constant TYPEHASH = keccak256(
        "Requisition(address agent,address buyer,address vendor,uint128 amount,bytes32 purposeHash,uint64 expiresAt,bytes32 nonce)"
    );
    bytes32 internal constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    function setUp() public virtual {
        (agent, agentPk) = makeAddrAndKey("agent");
        (otherSigner, otherPk) = makeAddrAndKey("otherSigner");
        vm.warp(START);
        usdc = new MockUSDC();
        book = new RequisitionBook(IERC20(address(usdc)));
        usdc.mint(buyer, BUYER_FUNDS);
        vm.prank(buyer);
        usdc.approve(address(book), type(uint256).max);
    }

    // ---------------------------------------------------------------- helpers

    function _reqFor(address buyer_, address vendor_, uint128 amount, bytes32 nonce)
        internal
        view
        returns (RequisitionBook.Requisition memory)
    {
        return RequisitionBook.Requisition({
            agent: agent,
            buyer: buyer_,
            vendor: vendor_,
            amount: amount,
            purposeHash: PURPOSE,
            expiresAt: uint64(block.timestamp + 1 days),
            nonce: nonce
        });
    }

    function _req(address vendor_, uint128 amount, bytes32 nonce)
        internal
        view
        returns (RequisitionBook.Requisition memory)
    {
        return _reqFor(buyer, vendor_, amount, nonce);
    }

    function _id(RequisitionBook.Requisition memory r) internal view returns (bytes32) {
        return book.hashRequisition(r);
    }

    function _signDigest(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 rr, bytes32 ss) = vm.sign(pk, digest);
        return abi.encodePacked(rr, ss, v);
    }

    function _sign(uint256 pk, RequisitionBook.Requisition memory r) internal view returns (bytes memory) {
        return _signDigest(pk, book.hashRequisition(r));
    }

    /// @dev Independent EIP-712 digest recomputation (does not call the book).
    function _independentDigest(RequisitionBook.Requisition memory r, uint256 chainId, address verifying)
        internal
        pure
        returns (bytes32)
    {
        bytes32 domainSep = keccak256(
            abi.encode(DOMAIN_TYPEHASH, keccak256(bytes("RequisitionBook")), keccak256(bytes("1")), chainId, verifying)
        );
        bytes32 structHash = keccak256(
            abi.encode(TYPEHASH, r.agent, r.buyer, r.vendor, r.amount, r.purposeHash, r.expiresAt, r.nonce)
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
    }

    function _record(bytes32 id) internal view returns (RequisitionBook.PaymentRecord memory) {
        (bool ok, bytes memory data) = address(book).staticcall(abi.encodeCall(book.records, (id)));
        require(ok, "records call failed");
        return abi.decode(data, (RequisitionBook.PaymentRecord));
    }

    /// @dev Builds n signed requests cycling over 3 vendors; amount 10e6 each; nonce = start+i.
    function _batch(uint256 n, uint256 nonceStart)
        internal
        view
        returns (RequisitionBook.Requisition[] memory rs, bytes[] memory sigs)
    {
        rs = new RequisitionBook.Requisition[](n);
        sigs = new bytes[](n);
        address[3] memory vs = [vendor, vendor2, vendor3];
        for (uint256 i = 0; i < n; i++) {
            rs[i] = _req(vs[i % 3], 10e6, bytes32(nonceStart + i));
            sigs[i] = _sign(agentPk, rs[i]);
        }
    }
}
