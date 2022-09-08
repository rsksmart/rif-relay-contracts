// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import './interfaces/ICollector.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';

contract Collector is ICollector {
    address private remainderAddress;
    RevenuePartner[] private partners;
    IERC20 public token;
    address public owner;

    modifier validShares(RevenuePartner[] memory _partners) {
        uint256 totalShares;

        for (uint256 i = 0; i < _partners.length; i++) {
            totalShares = totalShares + _partners[i].share;
            require(_partners[i].share > 0, '0 is not a valid share');
        }

        require(totalShares == 100, 'Total shares must add up to 100%');
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, 'Only owner can call this');
        _;
    }

    modifier noBalanceToShare() {
        uint256 balance = token.balanceOf(address(this));

        require(balance < partners.length, 'There is balance to share');

        _;
    }

    constructor(
        address _owner,
        IERC20 _token,
        RevenuePartner[] memory _partners,
        address _remainderAddress
    ) public validShares(_partners) {
        owner = _owner;
        token = _token;
        remainderAddress = _remainderAddress;
        for (uint256 i = 0; i < _partners.length; i++)
            partners.push(_partners[i]);
    }

    function updateShares(RevenuePartner[] memory _partners)
        external
        validShares(_partners)
        onlyOwner
        noBalanceToShare
    {
        delete partners;

        for (uint256 i = 0; i < _partners.length; i++)
            partners.push(_partners[i]);
    }

    //@notice Withdraw the actual remainder and then update the remainder's address
    //for a new one. This function is the only way to withdraw the remainder.
    function updateRemainderAddress(address _remainderAddress)
        external
        onlyOwner
        noBalanceToShare
    {
        address oldRemainderAddress = remainderAddress;
        remainderAddress = _remainderAddress;

        uint256 balance = token.balanceOf(address(this));

        if (balance != 0) {
            token.transfer(oldRemainderAddress, balance);
        }
    }

    function getBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function withdraw() external override onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        require(balance > partners.length, 'Not enough balance to split');

        for (uint256 i = 0; i < partners.length; i++)
            token.transfer(
                partners[i].beneficiary,
                SafeMath.div(SafeMath.mul(balance, partners[i].share), 100)
            );
    }

    function transferOwnership(address _owner) external override onlyOwner {
        require(_owner != address(0), 'New owner is the zero address');
        owner = _owner;
    }
}
