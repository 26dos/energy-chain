// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Multicall3 - Batch multiple read calls into a single RPC request
contract Multicall3 {
    struct Call {
        address target;
        bytes callData;
    }

    struct Call3 {
        address target;
        bool allowFailure;
        bytes callData;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    function aggregate(Call[] calldata calls) public payable returns (uint256 blockNumber, bytes[] memory returnData) {
        blockNumber = block.number;
        uint256 length = calls.length;
        returnData = new bytes[](length);
        for (uint256 i; i < length;) {
            (bool success, bytes memory ret) = calls[i].target.call(calls[i].callData);
            require(success, "Multicall3: call failed");
            returnData[i] = ret;
            unchecked { ++i; }
        }
    }

    function tryAggregate(bool requireSuccess, Call[] calldata calls) public payable returns (Result[] memory returnData) {
        uint256 length = calls.length;
        returnData = new Result[](length);
        for (uint256 i; i < length;) {
            (bool success, bytes memory ret) = calls[i].target.call(calls[i].callData);
            if (requireSuccess) require(success, "Multicall3: call failed");
            returnData[i] = Result(success, ret);
            unchecked { ++i; }
        }
    }

    function aggregate3(Call3[] calldata calls) public payable returns (Result[] memory returnData) {
        uint256 length = calls.length;
        returnData = new Result[](length);
        for (uint256 i; i < length;) {
            (bool success, bytes memory ret) = calls[i].target.call(calls[i].callData);
            if (!calls[i].allowFailure && !success) {
                revert("Multicall3: call failed");
            }
            returnData[i] = Result(success, ret);
            unchecked { ++i; }
        }
    }

    function getBlockNumber() public view returns (uint256 blockNumber) {
        blockNumber = block.number;
    }

    function getBlockHash(uint256 blockNumber) public view returns (bytes32 blockHash) {
        blockHash = blockhash(blockNumber);
    }

    function getCurrentBlockTimestamp() public view returns (uint256 timestamp) {
        timestamp = block.timestamp;
    }

    function getEthBalance(address addr) public view returns (uint256 balance) {
        balance = addr.balance;
    }

    function getCurrentBlockCoinbase() public view returns (address coinbase) {
        coinbase = block.coinbase;
    }

    function getChainId() public view returns (uint256 chainid) {
        chainid = block.chainid;
    }
}
