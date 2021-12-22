// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "./interfaces/ICollector.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract Collector is ICollector{

    address public multisigOwner;
    Shares private revenueShares;

    constructor(
        address _multisigOwner,
        Shares memory _shares
    )
    public
    validShares(_shares)
    {   
        multisigOwner = _multisigOwner;
        revenueShares = _shares;
    }

    function updateShares(Shares memory _shares) 
    public
    validShares(_shares)
    onlyMultisigOwner()
    {
        revenueShares = _shares;
    }

    receive() external payable{
        // relay payments should be made to this endpoint
    }

    function withdraw() 
    public 
    onlyMultisigOwner()
    {
        uint balance = address(this).balance;
        require(balance > 0, "no revenue to share");

        // calculate percentage of earnings correspondent to each beneficiary which revenues are shared with
        revenueShares.relayOperator.beneficiary.transfer(SafeMath.div(SafeMath.mul(balance, revenueShares.relayOperator.share), 100));
        revenueShares.walletProvider.beneficiary.transfer(SafeMath.div(SafeMath.mul(balance, revenueShares.walletProvider.share), 100));
        revenueShares.liquidityProvider.beneficiary.transfer(SafeMath.div(SafeMath.mul(balance, revenueShares.liquidityProvider.share), 100));
        revenueShares.iovLabsRecipient.beneficiary.transfer(SafeMath.div(SafeMath.mul(balance, revenueShares.iovLabsRecipient.share), 100));
    }

    modifier onlyMultisigOwner(){
        require(msg.sender == multisigOwner, "can only call from multisig owner");
        _;
    }

    modifier validShares(Shares memory _shares){
        // these require staments could eventually be removed if their addresses are deemed optional
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
