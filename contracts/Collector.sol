// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "./interfaces/ICollector.sol";

contract Collector is ICollector{

    Shares private revenueShares;

    constructor(Shares memory _shares)
    public
    validShares(_shares)
    {
        revenueShares = _shares;
    }

    function updateShares(Shares memory _shares) 
    public
    validShares(_shares)
    {
        revenueShares = _shares;
    }

    modifier validShares(Shares memory _shares){
        require(_shares.relayOperator.beneficiary != address(0), "relayOperator must be set");
        require(_shares.walletProvider.beneficiary != address(0), "walletProvider must be set");
        require(_shares.liquidityProvider.beneficiary != address(0), "liquidityProvider must be set");
        require(_shares.iovLabsRecipient.beneficiary != address(0), "iovLabsRecipient must be set");

        require(
            _shares.relayOperator.share +
            _shares.walletProvider.share +
            _shares.liquidityProvider.share + 
            _shares.iovLabsRecipient.share == 100,
            "total shares must add up to 100%"
        );

        _;
    }
}
