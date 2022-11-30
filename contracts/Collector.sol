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
        address tokenAddr = address(token);

        if (balance != 0) {
            // solhint-disable-next-line avoid-low-level-calls
            (bool success, bytes memory ret) = tokenAddr.call{gas: 200000}(
                abi.encodeWithSelector(
                    hex"a9059cbb",
                    _remainderAddress,
                    balance
                )
            );

            require(
                success && (ret.length == 0 || abi.decode(ret, (bool))),
                "Unable to transfer remainder"
            );
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

        address tokenAddr = address(token);

        for (uint256 i = 0; i < _partners.length; i++) {
            // solhint-disable-next-line avoid-low-level-calls
            (bool success, bytes memory ret) = tokenAddr.call(
                abi.encodeWithSelector(
                    hex"a9059cbb",
                    _partners[i].beneficiary,
                    SafeMath.div(SafeMath.mul(balance, _partners[i].share), 100)
                )
            );

            require(
                success && (ret.length == 0 || abi.decode(ret, (bool))),
                "Unable to withdraw"
            );
        }
    }

    function transferOwnership(address _owner) external override onlyOwner {
        require(_owner != address(0), "New owner is the zero address");
        owner = _owner;
    }
}
