// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

/**
 * Subset of the Lendaswap HTLCNative contract used by the verifiers.
 * See https://github.com/satoraHQ/lendaswap-contracts/blob/b2ca6a3a2262c405a5c3f61d7298e1d9fb4c135f/src/HTLCNative.sol
 */
interface IHTLCNative {
    struct RedeemInfo {
        bytes32 preimage;
        uint256 amount;
        address sender;
        uint256 timelock;
    }

    struct RedeemBySigInfo {
        bytes32 preimage;
        uint256 amount;
        address sender;
        uint256 timelock;
        address destination;
        address sweepToken;
        uint256 minAmountOut;
        bytes32 callsHash;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32);

    function isActive(
        bytes32 preimageHash,
        uint256 amount,
        address token,
        address sender,
        address claimAddress,
        uint256 timelock
    ) external view returns (bool);
}
