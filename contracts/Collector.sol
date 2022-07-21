// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "./interfaces/ICollector.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract Collector is ICollector{
    ERC20Burnable public token;
    address public owner;
    RevenuePartner[] private partners;

    constructor(
        address _owner,
        ERC20Burnable _token,
        RevenuePartner[] memory _partners
    )
    public
    validShares(_partners)
    {   
        owner = _owner;
        token = _token;
        for (uint i = 0; i < _partners.length; i++)
            partners.push(_partners[i]);
    }

    function updateShares(RevenuePartner[] memory _partners) 
    external
    validShares(_partners)
    onlyOwner()
    {
        uint balance = token.balanceOf(address(this));
        require(balance == 0, "can't update with balance > 0");
    
        delete partners;
        
        for (uint i = 0; i < _partners.length; i++)
            partners.push(_partners[i]);
    }

    function getBalance()
    external
    returns (uint)
    {
        return token.balanceOf(address(this));
    }

    function withdraw() 
    external 
    override
    onlyOwner()
    {
        uint balance = token.balanceOf(address(this));
        require(balance > 0, "no revenue to share");

        for(uint i = 0; i < partners.length; i++)
            token.transfer(partners[i].beneficiary, SafeMath.div(SafeMath.mul(balance, partners[i].share), 100));
        
        balance = token.balanceOf(address(this));
        if(balance > 0) {
            token.burn(balance);
        }
    }

    function transferOwnership(address _owner)
    external 
    override
    onlyOwner()
    {
        require(_owner != address(0), "new owner is the zero address");
        owner = _owner;
    }

    modifier validShares(RevenuePartner[] memory _partners){
        uint totalShares = 0;            
        for(uint i = 0; i < _partners.length; i++)
            totalShares = totalShares + _partners[i].share;

        require(totalShares == 100, "total shares must add up to 100%");

        _;
    }

    modifier onlyOwner(){
        require(msg.sender == owner, "can only call from owner");
        _;
    }
}
