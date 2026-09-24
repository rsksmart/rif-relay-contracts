// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

/**
 * Subset of the Lendaswap HTLCNative contract used by the verifiers.
 * See https://github.com/satoraHQ/lendaswap-contracts/blob/main/src/HTLCNative.sol
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

/**
 * Subset of the Lendaswap HTLCNativeCoordinator contract used by the verifiers.
 * See https://github.com/satoraHQ/lendaswap-contracts/blob/main/src/HTLCNativeCoordinator.sol
 */
interface IHTLCNativeCoordinator {
    struct Call {
        address target;
        uint256 value;
        bytes callData;
    }

    // Static parameters of redeemAndExecute that follow the calls array
    struct RedeemAndExecuteTail {
        address sweepToken;
        uint256 minAmountOut;
        address destination;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    // solhint-disable-next-line func-name-mixedcase
    function HTLC_NATIVE() external view returns (address);

    // The call validated by LendaswapUtils when the smart wallet redeems through the coordinator
    function redeemAndExecute(
        bytes32 preimage,
        uint256 amount,
        address htlcSender,
        uint256 timelock,
        Call[] calldata calls,
        address sweepToken,
        uint256 minAmountOut,
        address destination,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable;
}
