// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "./interfaces/ICollector.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract Collector is ICollector {
    address private _remainderAddress;
    RevenuePartner[] private _partners;
    IERC20 public token;
    address public owner;

    modifier validShares(RevenuePartner[] memory partners) {
        uint256 totalShares;

        for (uint256 i = 0; i < partners.length; i++) {
            require(partners[i].share > 0, "0 is not a valid share");
            totalShares = totalShares + partners[i].share;
        }

        require(totalShares == 100, "Shares must add up to 100%");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    modifier noBalanceToShare() {
        require(
            token.balanceOf(address(this)) < _partners.length,
            "There is balance to share"
        );
        _;
    }

    constructor(
        address _owner,
        IERC20 _token,
        RevenuePartner[] memory partners,
        address remainderAddress
    ) public validShares(partners) {
        owner = _owner;
        token = _token;
        _remainderAddress = remainderAddress;
        for (uint256 i = 0; i < partners.length; i++)
            _partners.push(partners[i]);
    }

    function getPartners() external view returns (RevenuePartner[] memory) {
        return _partners;
    }

    function updateShares(
        RevenuePartner[] memory partners
    ) external validShares(partners) onlyOwner noBalanceToShare {
        delete _partners;

        for (uint256 i = 0; i < partners.length; i++)
            _partners.push(partners[i]);
    }

    //@notice Withdraw the actual remainder and then update the remainder's address
    //for a new one. This function is the only way to withdraw the remainder.
    function updateRemainderAddress(
        address remainderAddress
    ) external onlyOwner noBalanceToShare {
        uint256 balance = token.balanceOf(address(this));

        if (balance != 0) {
            token.transfer(_remainderAddress, balance);
        }

        // solhint-disable-next-line
        _remainderAddress = remainderAddress;
    }

    function getBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function withdraw() external override onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        require(balance >= _partners.length, "Not enough balance to split");

        for (uint256 i = 0; i < _partners.length; i++)
            token.transfer(
                _partners[i].beneficiary,
                SafeMath.div(SafeMath.mul(balance, _partners[i].share), 100)
            );
    }

    function transferOwnership(address _owner) external override onlyOwner {
        require(_owner != address(0), "New owner is the zero address");
        owner = _owner;
    }
}
