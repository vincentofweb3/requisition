// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";

/// @dev 6-decimal mintable USDC mock with an issuer-style blocklist on transferFrom.
contract MockUSDC is ERC20 {
    mapping(address => bool) public blocklisted;

    error Blocklisted(address account);

    constructor() ERC20("Mock USDC", "mUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setBlocklisted(address account, bool flag) external {
        blocklisted[account] = flag;
    }

    function transferFrom(address from, address to, uint256 value) public virtual override returns (bool) {
        if (blocklisted[from]) revert Blocklisted(from);
        if (blocklisted[to]) revert Blocklisted(to);
        return super.transferFrom(from, to, value);
    }
}

interface ITokenReceiver {
    function tokensReceived() external;
}

/// @dev Malicious token: during transferFrom it (a) calls an arbitrary payload on `target`
/// (re-entry attempt) and (b) optionally calls a receiver hook on contract recipients.
contract ReentrantToken is MockUSDC {
    address public target;
    bytes public payload;
    bool public bubble; // if true, bubble re-entry failure; else swallow & record
    bool public hookEnabled;
    uint256 public attempts;
    bool public lastOk;
    bytes public lastRet;

    function arm(address target_, bytes calldata payload_, bool bubble_) external {
        target = target_;
        payload = payload_;
        bubble = bubble_;
    }

    function setHook(bool on) external {
        hookEnabled = on;
    }

    function lastSelector() external view returns (bytes4 sel) {
        bytes memory ret = lastRet;
        if (ret.length >= 4) {
            assembly {
                sel := mload(add(ret, 32))
            }
        }
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (payload.length > 0 && attempts == 0) {
            attempts++;
            (bool ok, bytes memory ret) = target.call(payload);
            lastOk = ok;
            lastRet = ret;
            if (!ok && bubble) {
                assembly {
                    revert(add(ret, 32), mload(ret))
                }
            }
        }
        bool res = super.transferFrom(from, to, value);
        if (hookEnabled && to.code.length > 0) {
            ITokenReceiver(to).tokensReceived();
        }
        return res;
    }
}

/// @dev Vendor contract that tries to re-enter the book when it receives tokens (via ReentrantToken hook).
contract ReentrantVendor is ITokenReceiver {
    address public target;
    bytes public payload;
    bool public bubble;
    uint256 public attempts;
    bool public lastOk;
    bytes public lastRet;

    function arm(address target_, bytes calldata payload_, bool bubble_) external {
        target = target_;
        payload = payload_;
        bubble = bubble_;
    }

    function lastSelector() external view returns (bytes4 sel) {
        bytes memory ret = lastRet;
        if (ret.length >= 4) {
            assembly {
                sel := mload(add(ret, 32))
            }
        }
    }

    function tokensReceived() external override {
        if (payload.length == 0) return;
        attempts++;
        (bool ok, bytes memory ret) = target.call(payload);
        lastOk = ok;
        lastRet = ret;
        if (!ok && bubble) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
    }
}

/// @dev Minimal ERC-1271 smart account: accepts only digests it was told to approve.
contract Mock1271Wallet is IERC1271 {
    mapping(bytes32 => bool) public approved;

    function approveDigest(bytes32 digest) external {
        approved[digest] = true;
    }

    function isValidSignature(bytes32 hash, bytes calldata) external view returns (bytes4) {
        return approved[hash] ? IERC1271.isValidSignature.selector : bytes4(0xffffffff);
    }
}
