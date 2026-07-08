// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../utils/FlyoverUtils.sol";

interface IFlyoverPegIn {
    enum PegInStates {
        UNPROCESSED_QUOTE,
        CALL_DONE,
        PROCESSED_QUOTE
    }

    function getQuoteStatus(
        bytes32 quoteHash
    ) external view returns (PegInStates);

    function hashPegInQuote(
        FlyoverUtils.PegInQuote calldata quote
    ) external view returns (bytes32);
}
