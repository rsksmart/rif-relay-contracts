// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "./interfaces/ICollector.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract Collector is ICollector, Ownable{
    IERC20 public token;
    mapping(uint => RevenuePartner) private partners;
    uint private partnersSize;

    constructor(
        IERC20 _token,
        RevenuePartner[] memory _partners
    )
    public
    validShares(_partners)
    {   
        token = _token;
        partnersSize = _partners.length;
        for (uint i = 0; i < partnersSize; i++)
            partners[i] = _partners[i];
    }

    function updateShares(RevenuePartner[] memory _partners) 
    public
    validShares(_partners)
    onlyOwner()
    {
        for (uint i = 0; i < partnersSize; i++)
            delete partners[i];
        
        partnersSize = _partners.length;
        for (uint i = 0; i < partnersSize; i++)
            partners[i] = _partners[i];
    }

    function withdraw() 
    external 
    override
    onlyOwner()
    {
        uint balance = token.balanceOf(address(this));
        require(balance > 0, "no revenue to share");

        for(uint i = 0; i < partnersSize; i++)
            token.transfer(partners[i].beneficiary, SafeMath.div(SafeMath.mul(balance, partners[i].share), 100));
    }

    modifier validShares(RevenuePartner[] memory _partners){
        uint totalShares = 0;            
        for(uint i = 0; i < _partners.length; i++)
            totalShares = totalShares + _partners[i].share;

        require(totalShares == 100, "total shares must add up to 100%");

        _;
    }
}
