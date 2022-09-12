// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract UtilToken is ERC20("Util Token", "TKN") {
    function mint(uint256 amount, address to) public {
        _mint(msg.sender, amount);
        _transfer(msg.sender, to, amount);
    }
}
