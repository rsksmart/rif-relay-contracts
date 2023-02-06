// SPDX-License-Identifier:MIT

pragma solidity ^0.6.12;

import "./Ownable.sol";

abstract contract TokenHandler is Ownable {
    mapping(address => bool) public tokens;
    address[] public acceptedTokens;

    function acceptToken(address token) external onlyOwner {
        require(token != address(0), "Token cannot be zero address");
        require(tokens[token] == false, "Token is already accepted");
        tokens[token] = true;
        acceptedTokens.push(token);
    }

    function removeToken(address token, uint256 index) external onlyOwner {
        require(token != address(0), "Token cannot be zero address");
        require(tokens[token] == true, "Token is not accepted");
        require(token == acceptedTokens[index], "Wrong token index");
        delete tokens[token];
        acceptedTokens[index] = acceptedTokens[acceptedTokens.length - 1];
        acceptedTokens.pop();
    }

    function getAcceptedTokens() external view returns (address[] memory) {
        return acceptedTokens;
    }

    function acceptsToken(address token) external view returns (bool) {
        return tokens[token];
    }
}
