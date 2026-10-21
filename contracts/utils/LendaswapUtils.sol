// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IHTLCNative.sol";
import "./MinLibBytes.sol";

/**
 * Validation of the HTLCNative redeems a swap smart wallet may execute.
 * Only `redeem` and `redeemBySig` are accepted: both pay the caller, the
 * smart wallet, and run no code chosen by the request before the wallet
 * pays the fee. A redeem through the HTLCNativeCoordinator runs the calls
 * the owner signed before the proceeds reach the wallet, so it is not
 * accepted and the coordinator must not be an allowed destination.
 */
library LendaswapUtils {
    //d592e483  =>  redeem(bytes32,uint256,address,uint256)
    bytes4 internal constant _REDEEM_SIGNATURE = 0xd592e483;

    //24499b44  =>  redeemBySig(bytes32,uint256,address,uint256,address,address,uint256,bytes32,uint8,bytes32,bytes32)
    bytes4 internal constant _REDEEM_BY_SIG_SIGNATURE = 0x24499b44;

    // keccak256("Redeem(bytes32 preimage,uint256 amount,address sender,uint256 timelock,address caller,address destination,address sweepToken,uint256 minAmountOut,bytes32 callsHash)")
    bytes32 internal constant _TYPEHASH_REDEEM =
        0x74ff405c3eb2504549cab9fef588f80b9fd717e2a30387e6ff7743feeb1f80e4;

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
     * @dev For the minimal wallet: decode the redeem data, validate that an
     * active swap is stored in the HTLCNative contract and quote the RBTC
     * the smart wallet will receive. Reverts if the data is not a redeem.
     * @param data The redeem data.
     * @param to The address of the HTLCNative contract.
     * @param contractAddr The smart wallet executing the redeem.
     * @param value The RBTC the smart wallet forwards with the call. The
     * HTLCNative redeems reject any value.
     * @return The amount of RBTC the smart wallet will receive.
     */
    function quoteRedeemProceeds(
        bytes calldata data,
        address to,
        address contractAddr,
        uint256 value
    ) internal view returns (uint256) {
        return _quote(data, to, contractAddr, value);
    }

    /**
     * @dev For the full wallet: the RBTC it holds after the call, before
     * paying the fee. Its balance less the value it forwards, plus what the
     * redeem of an active swap into it pays out. Reverts if the data is not
     * a redeem, or is a redeem the wallet cannot execute (inactive swap,
     * value on a nonpayable redeem).
     * @param data The call data.
     * @param to The destination contract.
     * @param contractAddr The smart wallet executing the call.
     * @param value The RBTC the smart wallet forwards with the call.
     * @return The amount of RBTC available to pay the fee.
     */
    function quoteNativeBalanceAfterRedeem(
        bytes calldata data,
        address to,
        address contractAddr,
        uint256 value
    ) internal view returns (uint256) {
        uint256 proceeds = _quote(data, to, contractAddr, value);

        // The wallet forwards value before paying the fee
        uint256 balance = contractAddr.balance;
        require(value <= balance, "Native balance too low");

        return balance - value + proceeds;
    }

    /**
     * @dev For the full wallet: the amount of `token` it holds after the
     * call, before paying the fee. A redeem pays out RBTC only, so this is
     * the wallet's token balance. The redeem is validated as above, so a
     * token fee never relaxes what the request may do.
     * @param data The call data.
     * @param to The destination contract.
     * @param contractAddr The smart wallet executing the call.
     * @param value The RBTC the smart wallet forwards with the call.
     * @param token The ERC20 token paying the fee.
     * @return The amount of `token` available to pay the fee.
     */
    function quoteTokenBalanceAfterRedeem(
        bytes calldata data,
        address to,
        address contractAddr,
        uint256 value,
        address token
    ) internal view returns (uint256) {
        _quote(data, to, contractAddr, value);

        // The wallet forwards value before paying the fee
        require(value <= contractAddr.balance, "Native balance too low");

        return IERC20(token).balanceOf(contractAddr);
    }

    /**
     * @dev Quote the RBTC a redeem pays to the smart wallet. Reverts if the
     * data is not one of the accepted redeem methods.
     */
    function _quote(
        bytes calldata data,
        address htlc,
        address contractAddr,
        uint256 value
    ) private view returns (uint256) {
        require(isRedeem(data), "Method not allowed");
        require(value == 0, "Value not allowed");

        bytes4 signature = MinLibBytes.readBytes4(data, 0);

        if (signature == _REDEEM_SIGNATURE) {
            return _quoteRedeem(data, htlc, contractAddr);
        }

        return _quoteRedeemBySig(data, htlc, contractAddr);
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
