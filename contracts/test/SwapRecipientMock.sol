// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;

/* solhint-disable no-inline-assembly */
/* solhint-disable avoid-low-level-calls */

/**
 * Test double for a swap contract called by a swap smart wallet. On any
 * call it re-enters the caller with a prepared call, as a coordinator
 * callback chosen by the request would, and/or pays the caller, as a
 * claim does. Not part of the package.
 */
contract SwapRecipientMock {
    uint256 public payout;
    bytes public reentrantCall;

    function setPayout(uint256 amount) external {
        payout = amount;
    }

    function setReentrantCall(bytes calldata data) external {
        reentrantCall = data;
    }

    fallback() external payable {
        if (reentrantCall.length > 0) {
            (bool success, bytes memory ret) = msg.sender.call(reentrantCall);
            if (!success) {
                assembly {
                    revert(add(ret, 32), mload(ret))
                }
            }
        }
        if (payout > 0) {
            (bool sent, ) = msg.sender.call{value: payout}("");
            require(sent, "Payout failed");
        }
    }

    receive() external payable {}
}
