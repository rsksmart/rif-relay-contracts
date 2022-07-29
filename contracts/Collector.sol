// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "./interfaces/ICollector.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract Collector is ICollector{
    IERC20 public token;
    address public owner;
    address private remainderAddress;
    RevenuePartner[] private partners;

    constructor(
        address _owner,
        IERC20 _token,
        RevenuePartner[] memory _partners,
        address _remainderAddress
    )
    public
    validShares(_partners)
    {   
        owner = _owner;
        token = _token;
        remainderAddress = _remainderAddress;
        for (uint i = 0; i < _partners.length; i++)
            partners.push(_partners[i]);
    }

    function updateShares(RevenuePartner[] memory _partners) 
    external
    validShares(_partners)
    onlyOwner()
    clearRemainder()
    {
    
        delete partners;
        
        for (uint i = 0; i < _partners.length; i++)
            partners.push(_partners[i]);
    }

    function updateRemainderAddress(address _remainderAddress) 
    external
    onlyOwner()
    clearRemainder()
    {
        remainderAddress = _remainderAddress;
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
        require(balance > partners.length, "no revenue to share");

        for(uint i = 0; i < partners.length; i++)
            token.transfer(partners[i].beneficiary, SafeMath.div(SafeMath.mul(balance, partners[i].share), 100));
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

    modifier clearRemainder(){
        uint balance = token.balanceOf(address(this));
        require(balance < partners.length, "balance > remainder");
        if(balance == 0) {
            return;
        }
        
        token.transfer(remainderAddress, balance);
            balance = token.balanceOf(address(this));
        _;
    }
}
