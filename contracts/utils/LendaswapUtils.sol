// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/ECDSA.sol";

import "../interfaces/IHTLCNative.sol";
import "./MinLibBytes.sol";

/**
 * Validation of the calls a Lendaswap swap smart wallet may execute: no call
 * at all (to is address(0)), or an HTLCNative `redeem` or `redeemBySig`. Both
 * pay the caller, the smart wallet, and run no code chosen by the request
 * before the wallet pays the fee. The verifiers must allow HTLCNative as the
 * only destination, besides address(0): a redeem through the
 * HTLCNativeCoordinator runs the calls the owner signed before the proceeds
 * reach the wallet.
 */
library LendaswapUtils {
    //d592e483  =>  redeem(bytes32,uint256,address,uint256)
    bytes4 internal constant _REDEEM_SIGNATURE = 0xd592e483;

    //24499b44  =>  redeemBySig(bytes32,uint256,address,uint256,address,address,uint256,bytes32,uint8,bytes32,bytes32)
    bytes4 internal constant _REDEEM_BY_SIG_SIGNATURE = 0x24499b44;

    // keccak256("Redeem(bytes32 preimage,uint256 amount,address sender,uint256 timelock,address caller,address destination,address sweepToken,uint256 minAmountOut,bytes32 callsHash)")
    bytes32 internal constant _TYPEHASH_REDEEM =
        0x74ff405c3eb2504549cab9fef588f80b9fd717e2a30387e6ff7743feeb1f80e4;

    // keccak256(abi.encode(new Call[](0))): the calls hash of a redeem with no calls
    bytes32 internal constant _EMPTY_CALLS_HASH =
        0x569e75fc77c1a856f6daaf9e69d8a9566ca34aa47f9133711ce065a571af0cfd;

    /**
     * @dev Whether the data calls one of the accepted HTLCNative redeem methods.
     */
    function isRedeem(bytes memory data) internal pure returns (bool) {
        if (data.length < 4) {
            return false;
        }

        bytes4 signature = MinLibBytes.readBytes4(data, 0);

        return
            signature == _REDEEM_SIGNATURE ||
            signature == _REDEEM_BY_SIG_SIGNATURE;
    }

    /**
     * @dev Validate the call a swap smart wallet executes: no call at all, or
     * an HTLCNative redeem, with no value forwarded. HTLCNative pays a
     * redeemBySig to its caller and ignores the destination, sweep token and
     * calls hash the claimant signed, which only a coordinator acts on; they
     * must still sign none, so that the guarantee doesn't rest on HTLCNative
     * ignoring them. Reverts otherwise.
     * @param data The call data.
     * @param to The destination contract, or address(0) for no call.
     * @param contractAddr The smart wallet executing the call.
     * @param value The RBTC the smart wallet forwards with the call.
     */
    function validateCall(
        bytes calldata data,
        address to,
        address contractAddr,
        uint256 value
    ) internal pure {
        require(value == 0, "Value not allowed");

        if (to == address(0)) {
            return;
        }

        require(isRedeem(data), "Method not allowed");

        if (MinLibBytes.readBytes4(data, 0) == _REDEEM_BY_SIG_SIGNATURE) {
            IHTLCNative.RedeemBySigInfo memory redeem = abi.decode(
                data[4:],
                (IHTLCNative.RedeemBySigInfo)
            );

            require(
                (redeem.destination == address(0) ||
                    redeem.destination == contractAddr) &&
                    redeem.sweepToken == address(0) &&
                    (redeem.callsHash == bytes32(0) ||
                        redeem.callsHash == _EMPTY_CALLS_HASH),
                "Redeem authorizes other calls"
            );
        }
    }

    /**
     * @dev The RBTC a call that passed validateCall pays the smart wallet:
     * the amount of the active swap it redeems, or 0 if there is no call.
     * Reverts if the swap is not active, so a fee is never charged against
     * proceeds the wallet won't receive.
     * @param data The call data.
     * @param to The HTLCNative contract, or address(0) for no call.
     * @param contractAddr The smart wallet executing the call.
     * @return The amount of RBTC the smart wallet will receive.
     */
    function quoteRedeemProceeds(
        bytes calldata data,
        address to,
        address contractAddr
    ) internal view returns (uint256) {
        if (to == address(0)) {
            return 0;
        }

        if (MinLibBytes.readBytes4(data, 0) == _REDEEM_SIGNATURE) {
            return _quoteRedeem(data, to, contractAddr);
        }

        return _quoteRedeemBySig(data, to, contractAddr);
    }

    /**
     * @dev redeem: the smart wallet is the claimAddress and receives the amount.
     */
    function _quoteRedeem(
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
    function _quoteRedeemBySig(
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
