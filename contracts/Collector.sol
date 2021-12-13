// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "./interfaces/ICollector.sol";

contract Collector is ICollector{

    Shares revenueShares;

    constructor(
        Shares memory _shares
    )public {
        require(
            _shares.relayOperator.beneficiary &&
            _shares.walletProvider.beneficiary &&
            _shares.liquidityProvider.beneficiary && 
            _shares.iovLabsRecipient.beneficiary
        );
    }
}
