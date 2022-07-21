// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";

contract BurnableTestToken is ERC20("Test Token", "TKN") {
    function mint(uint amount, address to) public {
        _mint(msg.sender, amount);
        _transfer(msg.sender, to, amount);
    }

    function burn(uint amount) public {
        _burn(msg.sender, amount);
    }
}