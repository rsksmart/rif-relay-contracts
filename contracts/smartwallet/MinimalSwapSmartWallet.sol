// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;

import "../utils/BoltzUtils.sol";

/* solhint-disable no-inline-assembly */
/* solhint-disable avoid-low-level-calls */

/**
 * Minimal smart wallet that can only claim a swap on deployment.
 * The claim methods it accepts are set once, when deploying the template:
 * the allowed selectors are immutable, so they live in the template code
 * and are shared by every proxy that delegates to it.
 */
contract MinimalSwapSmartWallet {
    uint256 private constant _MAX_ALLOWED_METHODS = 8;

    // Allowed method selectors, packed from the most significant bytes
    bytes32 private immutable _allowedMethods;

    bool private _isInitialized = false;

    /**
     * @param allowedMethods - Selectors of the claim methods the wallet can execute (up to 8)
     */
    constructor(bytes4[] memory allowedMethods) public {
        require(
            allowedMethods.length > 0 &&
                allowedMethods.length <= _MAX_ALLOWED_METHODS,
            "Invalid allowed methods length"
        );

        bytes32 packed;
        for (uint256 i = 0; i < allowedMethods.length; i++) {
            require(allowedMethods[i] != bytes4(0), "Invalid allowed method");
            packed |= bytes32(allowedMethods[i]) >> (i * 32);
        }

        _allowedMethods = packed;
    }

    /**
     * This Proxy will first charge for the deployment and then it will pass the
     * initialization scope to the wallet logic.
     * This function can only be called once, and it is called by the Factory during deployment
     * @param owner - The EOA that will own the smart wallet
     * @param feesReceiver - Recipient of payment
     * @param feesAmount - Amount to pay
     * @param feesGas - Gas limit of payment
     * @param to - Destination contract to execute
     * @param data - Data to be executed by destination contract
     */
    function initialize(
        address owner,
        address feesReceiver,
        uint256 feesAmount,
        uint256 feesGas,
        address to,
        bytes calldata data
    ) external {
        require(!_isInitialized, "Already initialized");
        require(owner != address(0), "Invalid owner");
        require(
            feesAmount == 0 || feesReceiver != address(0),
            "Invalid fees receiver"
        );

        _isInitialized = true;

        require(
            data.length >= 4 && isAllowedMethod(BoltzUtils.toBytes4(data, 0)),
            "Method not allowed"
        );

        bool success;
        bytes memory ret;
        // Although this check isn't strictly necessary, it's included to improve the transaction estimation
        if (to != address(0)) {
            (success, ret) = to.call(data);
            if (!success) {
                if (ret.length == 0) revert("Unable to execute");
                assembly {
                    revert(add(ret, 32), mload(ret))
                }
            }
        }

        if (feesAmount > 0) {
            (success, ret) = payable(feesReceiver).call{
                value: feesAmount,
                gas: feesGas
            }("");
            require(
                success && (ret.length == 0 || abi.decode(ret, (bool))),
                "Unable to pay for deployment"
            );
        }

        //If any balance has been added then transfer it to the owner EOA
        if (address(this).balance > 0) {
            //can't fail: req.from signed (off-chain) the request, so it must be an EOA...
            payable(owner).transfer(address(this).balance);
        }
    }

    function isAllowedMethod(bytes4 method) public view returns (bool) {
        if (method == bytes4(0)) return false;

        for (uint256 i = 0; i < _MAX_ALLOWED_METHODS; i++) {
            if (bytes4(_allowedMethods << (i * 32)) == method) return true;
        }

        return false;
    }

    function getAllowedMethods() external view returns (bytes4[] memory) {
        uint256 length;
        while (
            length < _MAX_ALLOWED_METHODS &&
            bytes4(_allowedMethods << (length * 32)) != bytes4(0)
        ) {
            length++;
        }

        bytes4[] memory allowedMethods = new bytes4[](length);
        for (uint256 i = 0; i < length; i++) {
            allowedMethods[i] = bytes4(_allowedMethods << (i * 32));
        }

        return allowedMethods;
    }

    /* solhint-disable no-empty-blocks */
    receive() external payable virtual {}
}
