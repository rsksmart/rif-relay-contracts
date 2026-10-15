// SPDX-License-Identifier:MIT

pragma solidity ^0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./TokenHandler.sol";

/**
 * Fee validation shared by the verifiers of the swap smart wallets.
 * A fee paid in an accepted ERC20 token needs the wallet to be sure to hold
 * it after the call. Every other request, including a sponsored one with no
 * fee, must be the claim of an active swap into the wallet, and the RBTC the
 * wallet is sure to hold afterwards must cover the fee. Validating sponsored
 * requests too keeps the relayer from paying the gas of a claim that can
 * only fail.
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
        if (tokenAmount > 0 && tokenContract != address(0)) {
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
     * @dev Validate that `data` claims an active swap into `payer` and quote
     * the RBTC `payer` is sure to hold after the call, before paying the fee.
     * Must revert if the request is not such a claim.
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
     * @dev Quote the amount of `token` `payer` is sure to hold after the
     * call, before paying the fee. By default the current balance: the swap
     * contracts pay out plain RBTC, so the call runs no code chosen by the
     * request that could spend it.
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
    ) internal view virtual returns (uint256) {
        (data, to, value);
        return IERC20(token).balanceOf(payer);
    }
}
