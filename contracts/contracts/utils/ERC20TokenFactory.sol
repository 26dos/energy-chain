// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title SimpleERC20 - A basic ERC-20 token created by the factory
contract SimpleERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_, uint256 totalSupply_, address owner_) ERC20(name_, symbol_) {
        _decimals = decimals_;
        _mint(owner_, totalSupply_);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}

/// @title ERC20TokenFactory - One-click token creation
contract ERC20TokenFactory {
    event TokenCreated(address indexed token, string name, string symbol, uint256 totalSupply, address indexed creator);

    address[] public allTokens;

    function createToken(
        string calldata name_,
        string calldata symbol_,
        uint8 decimals_,
        uint256 totalSupply_
    ) external returns (address token) {
        SimpleERC20 t = new SimpleERC20(name_, symbol_, decimals_, totalSupply_, msg.sender);
        token = address(t);
        allTokens.push(token);
        emit TokenCreated(token, name_, symbol_, totalSupply_, msg.sender);
    }

    function allTokensLength() external view returns (uint256) {
        return allTokens.length;
    }
}
