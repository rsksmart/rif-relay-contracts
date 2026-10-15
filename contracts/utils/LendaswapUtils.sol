// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IHTLCNative.sol";
import "./MinLibBytes.sol";

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

    // What a redeem leaves to the smart wallet
    struct Quote {
        // The RBTC the smart wallet is sure to receive
        uint256 nativeProceeds;
        // The token the coordinator sweeps to the smart wallet, if any, and
        // the amount of it the smart wallet is sure to receive
        address sweepToken;
        uint256 tokenProceeds;
        // The call runs code chosen by the request before the fee is paid.
        // That code can re-enter the smart wallet with an owner-signed
        // request and spend what it already holds.
        bool hasCallback;
    }

    /**
     * @dev Decode the redeem data, validate that an active swap is stored in
     * the HTLCNative contract and quote the RBTC the smart wallet will receive.
     * @param data The redeem data.
     * @param to The address of the HTLCNative contract, or of the
     * HTLCNativeCoordinator when calling redeemAndExecute.
     * @param contractAddr The smart wallet executing the redeem.
     * @param value The RBTC the smart wallet forwards with the call. Only
     * redeemAndExecute is payable; the HTLCNative redeems reject any value.
     * @return The amount of RBTC the smart wallet will receive.
     */
    function quoteRedeemProceeds(
        bytes calldata data,
        address to,
        address contractAddr,
        uint256 value
    ) internal view returns (uint256) {
        return _quote(data, to, contractAddr, value).nativeProceeds;
    }

    /**
     * @dev Quote the RBTC a smart wallet with an execute entry point is sure
     * to hold after the redeem call, before paying the fee. The balance it
     * already holds only counts when the call cannot run code chosen by the
     * request.
     * @param data The redeem data.
     * @param to The address of the HTLCNative contract, or of the
     * HTLCNativeCoordinator when calling redeemAndExecute.
     * @param contractAddr The smart wallet executing the redeem.
     * @param value The RBTC the smart wallet forwards with the call.
     * @return The amount of RBTC available to pay the fee.
     */
    function quoteNativeBalanceAfterRedeem(
        bytes calldata data,
        address to,
        address contractAddr,
        uint256 value
    ) internal view returns (uint256) {
        Quote memory quote = _quote(data, to, contractAddr, value);

        // The wallet forwards value before paying the fee
        uint256 balance = contractAddr.balance;
        require(value <= balance, "Native balance too low");

        if (quote.hasCallback) {
            return quote.nativeProceeds;
        }

        return balance - value + quote.nativeProceeds;
    }

    /**
     * @dev Quote the amount of `token` a smart wallet with an execute entry
     * point is sure to hold after the redeem call, before paying the fee.
     * Same rule as quoteNativeBalanceAfterRedeem: the balance it already
     * holds only counts without a callback, and the coordinator's sweep of
     * `token` to the smart wallet is credited for its signed minimum.
     * @param data The redeem data.
     * @param to The address of the HTLCNative contract, or of the
     * HTLCNativeCoordinator when calling redeemAndExecute.
     * @param contractAddr The smart wallet executing the redeem.
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
        Quote memory quote = _quote(data, to, contractAddr, value);

        // The wallet forwards value before paying the fee
        require(value <= contractAddr.balance, "Native balance too low");

        uint256 proceeds = quote.sweepToken == token ? quote.tokenProceeds : 0;

        if (quote.hasCallback) {
            return proceeds;
        }

        return IERC20(token).balanceOf(contractAddr) + proceeds;
    }

    function _quote(
        bytes calldata data,
        address to,
        address contractAddr,
        uint256 value
    ) private view returns (Quote memory quote) {
        bytes4 signature = MinLibBytes.readBytes4(data, 0);

        if (signature == _REDEEM_SIGNATURE) {
            require(value == 0, "Value not allowed");
            quote.nativeProceeds = _quoteRedeem(data, to, contractAddr);
        } else if (signature == _REDEEM_BY_SIG_SIGNATURE) {
            require(value == 0, "Value not allowed");
            quote.nativeProceeds = _quoteRedeemBySig(data, to, contractAddr);
        } else if (signature == _REDEEM_AND_EXECUTE_SIGNATURE) {
            quote = _quoteCoordinatorProceeds(data, to, contractAddr, value);
        } else {
            revert("Method not allowed");
        }
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
     * @dev redeemAndExecute: the coordinator is the authorized caller, runs the
     * signed calls and sweeps its whole balance to the signed destination.
     * Only a sweep to the smart wallet is credited: a native sweep for the
     * amount plus the forwarded value when there are no calls, otherwise for
     * the minAmountOut the coordinator enforces; a token sweep for its
     * minAmountOut. The calls, a sweep to another destination and a token
     * sweep all run code chosen by the request.
     */
    function _quoteCoordinatorProceeds(
        bytes calldata data,
        address coordinator,
        address contractAddr,
        uint256 value
    ) private view returns (Quote memory quote) {
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

        bool sweepsToWallet = redeem.destination == contractAddr;
        bool sweepsNative = redeem.sweepToken == address(0);

        quote.hasCallback = callsLength > 0 || !sweepsToWallet || !sweepsNative;

        if (!sweepsToWallet) {
            return quote;
        }

        if (sweepsNative) {
            quote.nativeProceeds = callsLength == 0
                ? redeem.amount + value
                : redeem.minAmountOut;
        } else {
            quote.sweepToken = redeem.sweepToken;
            quote.tokenProceeds = redeem.minAmountOut;
        }
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
