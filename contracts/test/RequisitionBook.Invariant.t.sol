// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {RequisitionBook} from "../src/RequisitionBook.sol";
import {MockUSDC} from "./mocks/Mocks.sol";
import {RequisitionBookTestBase} from "./RequisitionBook.Base.t.sol";

/// @dev Drives random valid and invalid pay/payBatch calls and tracks what SHOULD have been settled.
contract RequisitionHandler is Test {
    RequisitionBook public book;
    MockUSDC public usdc;
    address public buyer;
    address public agent;
    uint256 public agentPk;
    uint256 public otherPk;
    address[3] public vendors;

    uint256 public ghostPaid;
    uint256 public nonceCounter;
    uint256 public successCalls;
    uint256 public rejectedCalls;
    bytes32[] public paidIds;
    RequisitionBook.Requisition[] internal paidReqs;
    bytes[] internal paidSigs;

    constructor(
        RequisitionBook book_,
        MockUSDC usdc_,
        address buyer_,
        address agent_,
        uint256 agentPk_,
        uint256 otherPk_,
        address[3] memory vendors_
    ) {
        book = book_;
        usdc = usdc_;
        buyer = buyer_;
        agent = agent_;
        agentPk = agentPk_;
        otherPk = otherPk_;
        vendors = vendors_;
    }

    function paidCount() external view returns (uint256) {
        return paidIds.length;
    }

    function _build(uint256 amountSeed, uint256 vendorSeed, bool expired)
        internal
        returns (RequisitionBook.Requisition memory r)
    {
        r = RequisitionBook.Requisition({
            agent: agent,
            buyer: buyer,
            vendor: vendors[vendorSeed % 3],
            amount: uint128(bound(amountSeed, 1, 5_000e6)),
            purposeHash: keccak256(abi.encode("purpose", amountSeed)),
            expiresAt: expired ? uint64(block.timestamp) : uint64(block.timestamp + 1 days),
            nonce: bytes32(++nonceCounter)
        });
    }

    function _sig(uint256 pk, RequisitionBook.Requisition memory r) internal view returns (bytes memory) {
        (uint8 v, bytes32 rr, bytes32 ss) = vm.sign(pk, book.hashRequisition(r));
        return abi.encodePacked(rr, ss, v);
    }

    /// @param mode 0,4+: valid; 1: wrong signer; 2: expired; 3: replay of an earlier success
    function pay(uint256 amountSeed, uint256 vendorSeed, uint8 mode) external {
        mode = mode % 5;
        RequisitionBook.Requisition memory r;
        bytes memory sig;
        if (mode == 3 && paidReqs.length > 0) {
            uint256 idx = amountSeed % paidReqs.length;
            r = paidReqs[idx];
            sig = paidSigs[idx];
        } else {
            r = _build(amountSeed, vendorSeed, mode == 2);
            sig = _sig(mode == 1 ? otherPk : agentPk, r);
        }
        vm.prank(buyer);
        try book.pay(r, sig) returns (bytes32 id) {
            ghostPaid += r.amount;
            successCalls++;
            paidIds.push(id);
            paidReqs.push(r);
            paidSigs.push(sig);
        } catch {
            rejectedCalls++;
        }
    }

    /// @param badLast if true, the last item is signed by a non-agent so the whole batch must revert
    function payBatch(uint256 nSeed, uint256 amountSeed, uint256 vendorSeed, bool badLast) external {
        uint256 n = bound(nSeed, 1, 8);
        RequisitionBook.Requisition[] memory rs = new RequisitionBook.Requisition[](n);
        bytes[] memory sigs = new bytes[](n);
        uint256 total;
        for (uint256 i = 0; i < n; i++) {
            unchecked {
                rs[i] = _build(amountSeed + i, vendorSeed + i, false);
            }
            sigs[i] = _sig(badLast && i == n - 1 ? otherPk : agentPk, rs[i]);
            total += rs[i].amount;
        }
        vm.prank(buyer);
        try book.payBatch(rs, sigs) returns (bytes32[] memory ids) {
            ghostPaid += total;
            successCalls++;
            for (uint256 i = 0; i < n; i++) {
                paidIds.push(ids[i]);
                paidReqs.push(rs[i]);
                paidSigs.push(sigs[i]);
            }
        } catch {
            rejectedCalls++;
        }
    }
}

/// forge-config: default.invariant.runs = 64
/// forge-config: default.invariant.depth = 40
/// forge-config: default.invariant.fail-on-revert = false
contract RequisitionBookInvariantTest is RequisitionBookTestBase {
    RequisitionHandler internal handler;

    function setUp() public override {
        super.setUp();
        usdc.mint(buyer, 1e18); // ample funds; insufficient-balance paths are covered by unit tests
        handler = new RequisitionHandler(book, usdc, buyer, agent, agentPk, otherPk, [vendor, vendor2, vendor3]);
        targetContract(address(handler));
        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = RequisitionHandler.pay.selector;
        selectors[1] = RequisitionHandler.payBatch.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_BookHoldsNoUsdc() public view {
        assertEq(usdc.balanceOf(address(book)), 0);
    }

    function invariant_TotalPaidEqualsHandlerLedger() public view {
        assertEq(book.totalPaid(), handler.ghostPaid());
    }

    function invariant_VendorsReceivedExactlyWhatWasPaid() public view {
        assertEq(usdc.balanceOf(vendor) + usdc.balanceOf(vendor2) + usdc.balanceOf(vendor3), handler.ghostPaid());
    }

    function invariant_TotalPaidEqualsSumOfRecords() public view {
        uint256 sum;
        uint256 n = handler.paidCount();
        for (uint256 i = 0; i < n; i++) {
            bytes32 id = handler.paidIds(i);
            assertTrue(book.used(id));
            sum += _record(id).amount;
        }
        assertEq(book.totalPaid(), sum);
    }

    function invariant_CallSummary() public view {
        // Sanity: counters never go backwards relative to the paid ledger.
        assertGe(handler.paidCount(), handler.successCalls());
    }
}
