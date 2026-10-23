// SPDX-License-Identifier:MIT

pragma solidity ^0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./TokenHandler.sol";

/**
 * Fee validation shared by the verifiers of the full swap smart wallets,
 * which pay the fee after the call. Each verifier decides which calls it
 * accepts before this runs; the Lendaswap verifiers accept only calls that
 * run no code chosen by the request before the fee is paid. A sponsored
 * request (no fee) is not checked here, since the relayer chose to pay; a
 * fee in an accepted ERC20 token is charged from the wallet's token balance,
 * and a fee in RBTC from the wallet's RBTC balance plus what the call pays
 * it, so a wallet can claim its first swap before holding anything.
 */
abstract contract SwapFeeHandler is TokenHandler {
    function _validateFee(
        bytes calldata data,
        address to,
        address payer,
        uint256 value,
        address tokenContract,
        uint256 tokenAmount
    ) internal view {
        if (tokenAmount == 0) {
            return;
        }

        if (tokenContract != address(0)) {
            require(tokens[tokenContract], "Token contract not allowed");

            require(
                tokenAmount <=
                    _quoteTokenBalance(data, to, payer, value, tokenContract),
                "Token balance too low"
            );
        } else {
            require(
                tokenAmount <= _quoteNativeBalance(data, to, payer, value),
                "Native balance too low"
            );
        }
    }

    /**
     * @dev Quote the RBTC `payer` holds after the call, before paying the
     * fee: its balance less the value it forwards, plus what a claim of an
     * active swap into it pays out. A claim the wallet cannot execute
     * (inactive swap, value on a nonpayable claim) must revert. Which other
     * calls get here, if any, is the verifier's choice.
     * @param data The call data of the request.
     * @param to The destination contract of the request.
     * @param payer The smart wallet paying the fee.
     * @param value The RBTC the smart wallet forwards with the call.
     */
    function _quoteNativeBalance(
        bytes calldata data,
        address to,
        address payer,
        uint256 value
    ) internal view virtual returns (uint256);

    /**
     * @dev Quote the amount of `token` `payer` holds after the call, before
     * paying the fee: its balance, plus whatever the call is sure to deliver
     * to it in that token. A claim the wallet cannot execute must revert, as
     * above, so a token fee never relaxes what the request may do.
     * @param data The call data of the request.
     * @param to The destination contract of the request.
     * @param payer The smart wallet paying the fee.
     * @param value The RBTC the smart wallet forwards with the call.
     * @param token The ERC20 token paying the fee.
     */
    function _quoteTokenBalance(
        bytes calldata data,
        address to,
        address payer,
        uint256 value,
        address token
    ) internal view virtual returns (uint256);
}
