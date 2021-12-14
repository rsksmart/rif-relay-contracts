// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "./interfaces/ICollector.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract Collector is ICollector{

    Shares private revenueShares;

    constructor(Shares memory _shares)
    public
    validShares(_shares)
    {
        revenueShares = _shares;
    }

    // TODO: add multisig requirement
    function updateShares(Shares memory _shares) 
    public
    validShares(_shares)
    {
        revenueShares = _shares;
    }

    receive() external payable{
        // Relay payments should be made to this endpoint
    }

    // TODO: add multisig requirement
    function withdraw() public {
        uint balance = address(this).balance;
        
        // Calculate percentage of earnings correspondent to each beneficiary which revenues are shared with
        revenueShares.relayOperator.beneficiary.transfer(SafeMath.mul(SafeMath.div(balance, 100), revenueShares.relayOperator.share));
        revenueShares.walletProvider.beneficiary.transfer(SafeMath.mul(SafeMath.div(balance, 100), revenueShares.walletProvider.share));
        revenueShares.liquidityProvider.beneficiary.transfer(SafeMath.mul(SafeMath.div(balance, 100), revenueShares.liquidityProvider.share));
        revenueShares.iovLabsRecipient.beneficiary.transfer(SafeMath.mul(SafeMath.div(balance, 100), revenueShares.iovLabsRecipient.share));
    }

    modifier validShares(Shares memory _shares){
        // These requires could eventually be removed if their addresses are deemed optional
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
