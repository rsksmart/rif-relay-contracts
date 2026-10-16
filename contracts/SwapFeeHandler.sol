// SPDX-License-Identifier:MIT

pragma solidity ^0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./TokenHandler.sol";

/**
 * Fee validation shared by the verifiers of the full swap smart wallets.
 * The wallet is a general purpose RIF Relay wallet whose verifier allows
 * the swap contracts as destinations, so the fee is validated as for any
 * other wallet: a sponsored request (no fee) only needs an allowed
 * destination, since the relayer chose to pay; a fee in an accepted ERC20
 * token is charged from the wallet's token balance; a fee in RBTC is
 * charged from the wallet's RBTC balance. The one addition is that a claim
 * of an active swap into the wallet is credited for the RBTC it pays out,
 * so a wallet can claim its first swap before holding anything.
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
     * active swap into it pays out. Any other call adds nothing. A claim the
     * wallet cannot execute (inactive swap, value on a nonpayable claim)
     * must revert.
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
