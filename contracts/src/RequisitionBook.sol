// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title RequisitionBook
/// @notice Non-custodial settlement of agent-signed purchase requests submitted by their named buyers.
/// @dev USDC moves directly from buyer to vendor; this contract never takes custody during settlement.
/// There is no admin, owner, role, upgrade mechanism, fee, or withdrawal/rescue facility.
/// Buyers must approve this contract on USDC for at least the total amount they intend to pay.
/// Amounts are raw USDC units (6 decimals on Arc testnet). The constructor token is trusted to be USDC.
/// A USDC issuer blocklist can make transfers revert; any failed transfer reverts the whole batch.
/// EIP-712 signatures bind requests to this chain and contract. Agents may be EOAs or ERC-1271 accounts.
/// Unsolicited ERC-20 transfers cannot be prevented and cannot be recovered here.
contract RequisitionBook is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Purchase authorization signed by the agent; nonce distinguishes otherwise identical requests.
    struct Requisition {
        address agent;
        address buyer;
        address vendor;
        uint128 amount;
        bytes32 purposeHash;
        uint64 expiresAt;
        bytes32 nonce;
    }

    /// @notice Immutable-in-practice receipt for a successfully settled request, keyed by its digest.
    struct PaymentRecord {
        address agent;
        address buyer;
        address vendor;
        uint128 amount;
        bytes32 purposeHash;
        uint64 expiresAt;
        uint64 paidAt;
        bytes32 nonce;
    }

    /// @notice Exact EIP-712 type hash for the agent's authorization.
    bytes32 public constant REQUISITION_TYPEHASH = keccak256(
        "Requisition(address agent,address buyer,address vendor,uint128 amount,bytes32 purposeHash,uint64 expiresAt,bytes32 nonce)"
    );

    /// @notice USDC token used for direct buyer-to-vendor transfers.
    IERC20 public immutable usdc;
    /// @notice Maximum requests accepted in one atomic batch.
    uint256 public constant MAX_BATCH = 50;
    /// @notice Cumulative amount settled, in raw USDC units; not a contract balance.
    uint256 public totalPaid;
    /// @notice Whether an EIP-712 request digest has already been settled.
    mapping(bytes32 => bool) public used;
    /// @notice Settlement receipt by digest; unset entries contain zero-valued fields.
    mapping(bytes32 => PaymentRecord) public records;

    error ZeroUsdc();
    error NotBuyer();
    error ZeroAgent();
    error ZeroVendor();
    error VendorIsContract();
    error ZeroAmount();
    error ZeroPurposeHash();
    error Expired();
    error AlreadyUsed(bytes32 requestId);
    error InvalidSignature();
    error EmptyBatch();
    error LengthMismatch();
    error BatchTooLarge();

    /// @notice Emitted after a successful direct USDC transfer.
    /// @param requestId EIP-712 digest of the settled request.
    /// @param agent Agent whose signature authorized the request.
    /// @param buyer Buyer who submitted and funded the request.
    /// @param vendor Recipient of the USDC transfer.
    /// @param amount Amount transferred, in raw USDC units.
    /// @param purposeHash Hash identifying the purchase purpose.
    /// @param expiresAt Exclusive expiry timestamp of the authorization.
    /// @param nonce Agent-selected request discriminator.
    event RequisitionPaid(
        bytes32 indexed requestId,
        address indexed agent,
        address indexed buyer,
        address vendor,
        uint256 amount,
        bytes32 purposeHash,
        uint64 expiresAt,
        bytes32 nonce
    );

    /// @notice Sets the USDC token permanently and initializes the EIP-712 domain.
    /// @param usdc_ Nonzero Arc testnet USDC ERC-20 address (6 decimals).
    constructor(IERC20 usdc_) EIP712("RequisitionBook", "1") {
        if (address(usdc_) == address(0)) revert ZeroUsdc();
        usdc = usdc_;
    }

    /// @notice Returns the signing digest and request identifier without validating the request.
    /// @param r Request fields in the exact signed order.
    /// @return digest Chain- and contract-bound EIP-712 digest.
    function hashRequisition(Requisition calldata r) public view returns (bytes32 digest) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    REQUISITION_TYPEHASH, r.agent, r.buyer, r.vendor, r.amount, r.purposeHash, r.expiresAt, r.nonce
                )
            )
        );
    }

    /// @notice Settles one signed request; only its named buyer may submit it.
    /// @dev Buyer must have sufficient USDC balance and allowance. Transfer failures revert all effects.
    /// @param r Agent-authorized purchase request.
    /// @param signature EOA ECDSA or ERC-1271 signature, checked at settlement time.
    /// @return requestId EIP-712 digest recorded for this payment.
    function pay(Requisition calldata r, bytes calldata signature) external nonReentrant returns (bytes32 requestId) {
        return _pay(r, signature);
    }

    /// @notice Atomically settles 1 to MAX_BATCH requests, all naming the caller as buyer.
    /// @dev Approve at least the sum of amounts on USDC. Any failure, including an issuer blocklist
    /// rejection or a duplicate digest within this batch, reverts every transfer and record in the batch.
    /// @param rs Ordered requests to settle.
    /// @param signatures Corresponding agent signatures, one per request.
    /// @return requestIds Settled EIP-712 digests in input order.
    function payBatch(Requisition[] calldata rs, bytes[] calldata signatures)
        external
        nonReentrant
        returns (bytes32[] memory requestIds)
    {
        uint256 length = rs.length;
        if (length != signatures.length) revert LengthMismatch();
        if (length == 0) revert EmptyBatch();
        if (length > MAX_BATCH) revert BatchTooLarge();

        requestIds = new bytes32[](length);
        for (uint256 i = 0; i < length; ++i) {
            requestIds[i] = _pay(rs[i], signatures[i]);
        }
    }

    /// @dev Validates in order, records effects before transferring, then emits the receipt.
    /// Signature checking may perform an ERC-1271 static call before effects are written.
    function _pay(Requisition calldata r, bytes calldata sig) internal returns (bytes32 requestId) {
        if (msg.sender != r.buyer) revert NotBuyer();
        if (r.agent == address(0)) revert ZeroAgent();
        if (r.vendor == address(0)) revert ZeroVendor();
        if (r.vendor == address(this)) revert VendorIsContract();
        if (r.amount == 0) revert ZeroAmount();
        if (r.purposeHash == bytes32(0)) revert ZeroPurposeHash();
        if (r.expiresAt <= block.timestamp) revert Expired();
        requestId = hashRequisition(r);
        if (used[requestId]) revert AlreadyUsed(requestId);
        if (!SignatureChecker.isValidSignatureNow(r.agent, requestId, sig)) revert InvalidSignature();

        used[requestId] = true;
        records[requestId] = PaymentRecord({
            agent: r.agent,
            buyer: r.buyer,
            vendor: r.vendor,
            amount: r.amount,
            purposeHash: r.purposeHash,
            expiresAt: r.expiresAt,
            paidAt: uint64(block.timestamp),
            nonce: r.nonce
        });
        totalPaid += r.amount;
        usdc.safeTransferFrom(r.buyer, r.vendor, r.amount);

        emit RequisitionPaid(requestId, r.agent, r.buyer, r.vendor, r.amount, r.purposeHash, r.expiresAt, r.nonce);
    }
}
