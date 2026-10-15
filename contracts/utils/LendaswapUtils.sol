// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/ECDSA.sol";

import "../interfaces/IHTLCNative.sol";
import "./BoltzUtils.sol";

library LendaswapUtils {
    //d592e483  =>  redeem(bytes32,uint256,address,uint256)
    bytes4 internal constant _REDEEM_SIGNATURE = 0xd592e483;

    //24499b44  =>  redeemBySig(bytes32,uint256,address,uint256,address,address,uint256,bytes32,uint8,bytes32,bytes32)
    bytes4 internal constant _REDEEM_BY_SIG_SIGNATURE = 0x24499b44;

    //81838615  =>  redeemAndExecute(bytes32,uint256,address,uint256,(address,uint256,bytes)[],address,uint256,address,uint8,bytes32,bytes32)
    bytes4 internal constant _REDEEM_AND_EXECUTE_SIGNATURE = 0x81838615;

    // keccak256("Redeem(bytes32 preimage,uint256 amount,address sender,uint256 timelock,address caller,address destination,address sweepToken,uint256 minAmountOut,bytes32 callsHash)")
    bytes32 internal constant _TYPEHASH_REDEEM =
        0x74ff405c3eb2504549cab9fef588f80b9fd717e2a30387e6ff7743feeb1f80e4;

    // Size of the redeemAndExecute head up to (and including) the calls offset
    uint256 private constant _REDEEM_AND_EXECUTE_TAIL_OFFSET = 4 + 5 * 32;

    /**
     * @dev Decode the redeem data and validate if
     * an active swap is stored in the HTLCNative contract.
     * @param data The redeem data.
     * @param to The address of the HTLCNative contract, or of the
     * HTLCNativeCoordinator when calling redeemAndExecute.
     * @param contractAddr The smart wallet executing the redeem.
     * @param value The RBTC the smart wallet forwards with the call. Only
     * redeemAndExecute is payable; the HTLCNative redeems reject any value.
     * @return The amount of RBTC the smart wallet will receive.
     */
    function validateRedeem(
        bytes calldata data,
        address to,
        address contractAddr,
        uint256 value
    ) internal view returns (uint256) {
        bytes4 signature = BoltzUtils.toBytes4(data, 0);

        if (signature == _REDEEM_SIGNATURE) {
            require(value == 0, "Value not allowed");
            return _validateRedeem(data, to, contractAddr);
        } else if (signature == _REDEEM_BY_SIG_SIGNATURE) {
            require(value == 0, "Value not allowed");
            return _validateRedeemBySig(data, to, contractAddr);
        } else if (signature == _REDEEM_AND_EXECUTE_SIGNATURE) {
            return _validateRedeemAndExecute(data, to, contractAddr);
        }

        revert("Method not allowed");
    }

    /**
     * @dev redeem: the smart wallet is the claimAddress and receives the amount.
     */
    function _validateRedeem(
        bytes calldata data,
        address htlc,
        address contractAddr
    ) private view returns (uint256) {
        IHTLCNative.RedeemInfo memory redeem = abi.decode(
            data[4:],
            (IHTLCNative.RedeemInfo)
        );

        _requireActive(
            htlc,
            redeem.preimage,
            redeem.amount,
            redeem.sender,
            contractAddr,
            redeem.timelock
        );

        return redeem.amount;
    }

    /**
     * @dev redeemBySig: the smart wallet is the authorized caller and
     * receives the amount; the claimAddress is the signer.
     */
    function _validateRedeemBySig(
        bytes calldata data,
        address htlc,
        address contractAddr
    ) private view returns (uint256) {
        IHTLCNative.RedeemBySigInfo memory redeem = abi.decode(
            data[4:],
            (IHTLCNative.RedeemBySigInfo)
        );

        address claimAddress = _recoverClaimAddress(htlc, redeem, contractAddr);

        _requireActive(
            htlc,
            redeem.preimage,
            redeem.amount,
            redeem.sender,
            claimAddress,
            redeem.timelock
        );

        return redeem.amount;
    }

    /**
     * @dev redeemAndExecute: the coordinator is the authorized caller, runs the
     * signed calls and sweeps its balance to the signed destination. Only a
     * native sweep to the smart wallet is credited: the whole amount if there
     * are no calls, otherwise the minAmountOut the coordinator enforces.
     */
    function _validateRedeemAndExecute(
        bytes calldata data,
        address coordinator,
        address contractAddr
    ) private view returns (uint256) {
        IHTLCNative.RedeemBySigInfo memory redeem;
        uint256 callsLength;
        (redeem, callsLength) = _decodeRedeemAndExecute(data);

        address htlc = IHTLCNativeCoordinator(coordinator).HTLC_NATIVE();

        address claimAddress = _recoverClaimAddress(htlc, redeem, coordinator);

        _requireActive(
            htlc,
            redeem.preimage,
            redeem.amount,
            redeem.sender,
            claimAddress,
            redeem.timelock
        );

        if (
            redeem.destination != contractAddr ||
            redeem.sweepToken != address(0)
        ) {
            return 0;
        }

        return callsLength == 0 ? redeem.amount : redeem.minAmountOut;
    }

    function _decodeRedeemAndExecute(
        bytes calldata data
    )
        private
        pure
        returns (IHTLCNative.RedeemBySigInfo memory redeem, uint256 callsLength)
    {
        IHTLCNativeCoordinator.Call[] memory calls;
        (
            redeem.preimage,
            redeem.amount,
            redeem.sender,
            redeem.timelock,
            calls
        ) = abi.decode(
            data[4:],
            (bytes32, uint256, address, uint256, IHTLCNativeCoordinator.Call[])
        );

        IHTLCNativeCoordinator.RedeemAndExecuteTail memory tail = abi.decode(
            data[_REDEEM_AND_EXECUTE_TAIL_OFFSET:],
            (IHTLCNativeCoordinator.RedeemAndExecuteTail)
        );

        redeem.destination = tail.destination;
        redeem.sweepToken = tail.sweepToken;
        redeem.minAmountOut = tail.minAmountOut;
        redeem.callsHash = keccak256(abi.encode(calls));
        redeem.v = tail.v;
        redeem.r = tail.r;
        redeem.s = tail.s;

        callsLength = calls.length;
    }

    /**
     * @dev Recover the claimAddress from the EIP-712 Redeem signature,
     * the same way HTLCNative.redeemBySig does.
     */
    function _recoverClaimAddress(
        address htlc,
        IHTLCNative.RedeemBySigInfo memory redeem,
        address caller
    ) private view returns (address) {
        bytes32 structHash = keccak256(
            abi.encodePacked(
                abi.encode(
                    _TYPEHASH_REDEEM,
                    redeem.preimage,
                    redeem.amount,
                    redeem.sender,
                    redeem.timelock
                ),
                abi.encode(
                    caller,
                    redeem.destination,
                    redeem.sweepToken,
                    redeem.minAmountOut,
                    redeem.callsHash
                )
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                IHTLCNative(htlc).DOMAIN_SEPARATOR(),
                structHash
            )
        );

        return ECDSA.recover(digest, redeem.v, redeem.r, redeem.s);
    }

    function _requireActive(
        address htlc,
        bytes32 preimage,
        uint256 amount,
        address sender,
        address claimAddress,
        uint256 timelock
    ) private view {
        require(
            IHTLCNative(htlc).isActive(
                sha256(abi.encodePacked(preimage)),
                amount,
                address(0),
                sender,
                claimAddress,
                timelock
            ),
            "Verifier: swap not active"
        );
    }
}
