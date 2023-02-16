// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "./interfaces/ICollector.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract Collector is ICollector {
    address private _remainderAddress;
    RevenuePartner[] private _partners;
    IERC20[] private _tokens;
    address public owner;
    mapping(IERC20 => bool) public tokenMap;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    modifier noBalanceToShare() {
        for (uint256 i = 0; i < _tokens.length; i++) {
            require(
                _tokens[i].balanceOf(address(this)) < _partners.length,
                "There is balance to share"
            );
        }
        _;
    }

    modifier updateValidShares(RevenuePartner[] memory partners) {
        _;
        uint256 totalShares;
        for (uint256 i = 0; i < partners.length; i++) {
            require(partners[i].share > 0, "0 is not a valid share");
            totalShares = totalShares + partners[i].share;
            _partners.push(partners[i]);
        }
        require(totalShares == 100, "Shares must add up to 100%");
    }

    constructor(
        address _owner,
        IERC20[] memory tokens,
        RevenuePartner[] memory partners,
        address remainderAddress
    ) public updateValidShares(partners) {
        owner = _owner;
        _remainderAddress = remainderAddress;

        for (uint i = 0; i < tokens.length; i++) {
            _tokens.push(tokens[i]);
            tokenMap[tokens[i]] = true;
        }
    }

    function getPartners() external view returns (RevenuePartner[] memory) {
        return _partners;
    }

    function updateShares(
        RevenuePartner[] memory partners
    ) external onlyOwner noBalanceToShare updateValidShares(partners) {
        delete _partners;
    }

    //@notice Withdraw the actual remainder and then update the remainder's address
    //for a new one. This function is the only way to withdraw the remainder.
    function updateRemainderAddress(
        address remainderAddress
    ) external onlyOwner noBalanceToShare {
        for (uint256 i = 0; i < _tokens.length; i++) {
            IERC20 token = _tokens[i];
            uint256 balance = token.balanceOf(address(this));

            if (balance != 0) {
                // solhint-disable-next-line avoid-low-level-calls
                (bool success, bytes memory ret) = address(token).call(
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
        }
        _remainderAddress = remainderAddress;
    }

    function addToken(IERC20 token) external onlyOwner {
        require(tokenMap[token] == false, "Token is already accepted");
        tokenMap[token] = true;
        _tokens.push(token);
    }

    function getTokens() external view returns (IERC20[] memory) {
        return _tokens;
    }

    function removeToken(IERC20 token, uint256 tokenIndex) external onlyOwner {
        require(tokenMap[token] == true, "Token is not accepted");
        require(_tokens[tokenIndex] == token, "Incorrect token");
        require(
            _tokens[tokenIndex].balanceOf(address(this)) == 0,
            "There is balance to share"
        );

        delete tokenMap[token];
        _tokens[tokenIndex] = _tokens[_tokens.length - 1];
        _tokens.pop();
    }

    function getRemainderAddress() external view returns (address) {
        return _remainderAddress;
    }

    function withdrawToken(IERC20 token) public onlyOwner {
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

    function withdraw() external override onlyOwner {
        for (uint256 i = 0; i < _tokens.length; i++) {
            withdrawToken(_tokens[i]);
        }
    }

    function transferOwnership(address _owner) external override onlyOwner {
        require(_owner != address(0), "Owner cannot be zero address");
        owner = _owner;
    }
}
