// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title EnergyDataAttestation - 通用能源数据存证与溯源合约
/// @notice 任意能源数据（合同、结算、充电、计量等）均可通过本合约上链存证。
///         链上只存数据哈希与元信息，不存原始数据，保证隐私的同时实现可溯源。
///
/// 溯源原理：
///   1. 提交者在链下对原始数据计算 keccak256 哈希
///   2. 将哈希 + 业务类型 + 备注 提交到本合约，合约记录：
///      - 数据哈希 (dataHash)
///      - 提交者地址 (submitter) —— 证明"谁"提交
///      - 区块时间戳 (timestamp) —— 证明"何时"提交
///      - 区块号 (blockNumber) —— 可定位到具体区块
///      - 交易哈希 —— 通过 tx receipt 获取
///   3. 验证时：任何人拿原始数据重新算哈希，查链上记录是否存在且匹配
///      - 哈希匹配 → 数据未被篡改
///      - 链上时间戳 → 证明数据在该时间点已存在
///      - 提交者地址 → 证明由谁背书
///   4. 区块链的不可篡改性保证：一旦上链，任何人（包括提交者）都无法修改或删除

contract EnergyDataAttestation {

    struct Attestation {
        bytes32 dataHash;       // 原始数据的 keccak256 哈希
        address submitter;      // 提交者地址
        uint64  timestamp;      // 上链时间（区块时间戳）
        uint64  blockNumber;    // 上链区块号
        string  dataType;       // 业务类型标签（如 "vpp_contract", "charging_order", "meter_reading"）
        string  memo;           // 备注（可选，简要描述）
    }

    uint256 public totalAttestations;

    // 按全局自增 ID 存储
    mapping(uint256 => Attestation) private _attestations;

    // dataHash => attestation ID（同一哈希只能存证一次，防重复）
    mapping(bytes32 => uint256) private _hashToId;

    // submitter => attestation IDs
    mapping(address => uint256[]) private _submitterAttestations;

    // dataType => attestation IDs
    mapping(string => uint256[]) private _typeAttestations;

    event DataAttested(
        uint256 indexed id,
        bytes32 indexed dataHash,
        address indexed submitter,
        string  dataType,
        uint64  timestamp,
        uint64  blockNumber
    );

    /// @notice 提交数据存证
    /// @param dataHash  原始数据的 keccak256 哈希（链下计算）
    /// @param dataType  业务类型标签
    /// @param memo      备注信息
    /// @return id       存证记录 ID
    function attest(
        bytes32 dataHash,
        string calldata dataType,
        string calldata memo
    ) external returns (uint256 id) {
        require(dataHash != bytes32(0), "empty hash");
        require(_hashToId[dataHash] == 0, "hash already attested");

        totalAttestations++;
        id = totalAttestations;

        _attestations[id] = Attestation({
            dataHash: dataHash,
            submitter: msg.sender,
            timestamp: uint64(block.timestamp),
            blockNumber: uint64(block.number),
            dataType: dataType,
            memo: memo
        });

        _hashToId[dataHash] = id;
        _submitterAttestations[msg.sender].push(id);
        _typeAttestations[dataType].push(id);

        emit DataAttested(id, dataHash, msg.sender, dataType, uint64(block.timestamp), uint64(block.number));
    }

    /// @notice 批量提交存证（节省 gas）
    /// @param dataHashes  哈希数组
    /// @param dataType    统一的业务类型
    /// @param memo        统一的备注
    /// @return startId    第一条记录的 ID
    function batchAttest(
        bytes32[] calldata dataHashes,
        string calldata dataType,
        string calldata memo
    ) external returns (uint256 startId) {
        require(dataHashes.length > 0, "empty batch");
        require(dataHashes.length <= 100, "batch too large");

        startId = totalAttestations + 1;

        for (uint256 i = 0; i < dataHashes.length; i++) {
            bytes32 h = dataHashes[i];
            require(h != bytes32(0), "empty hash in batch");
            require(_hashToId[h] == 0, "duplicate hash in batch");

            totalAttestations++;
            uint256 id = totalAttestations;

            _attestations[id] = Attestation({
                dataHash: h,
                submitter: msg.sender,
                timestamp: uint64(block.timestamp),
                blockNumber: uint64(block.number),
                dataType: dataType,
                memo: memo
            });

            _hashToId[h] = id;
            _submitterAttestations[msg.sender].push(id);
            _typeAttestations[dataType].push(id);

            emit DataAttested(id, h, msg.sender, dataType, uint64(block.timestamp), uint64(block.number));
        }
    }

    // ==================== 查询 ====================

    /// @notice 按 ID 查询存证
    function getAttestation(uint256 id) external view returns (Attestation memory) {
        require(id > 0 && id <= totalAttestations, "invalid id");
        return _attestations[id];
    }

    /// @notice 按数据哈希查询（核心溯源接口）
    /// @return exists  是否存在
    /// @return a       存证记录
    function verifyByHash(bytes32 dataHash) external view returns (bool exists, Attestation memory a) {
        uint256 id = _hashToId[dataHash];
        if (id == 0) {
            return (false, a);
        }
        return (true, _attestations[id]);
    }

    /// @notice 查询某提交者的所有存证 ID
    function getAttestationsBySubmitter(address submitter) external view returns (uint256[] memory) {
        return _submitterAttestations[submitter];
    }

    /// @notice 查询某业务类型的所有存证 ID
    function getAttestationsByType(string calldata dataType) external view returns (uint256[] memory) {
        return _typeAttestations[dataType];
    }

    /// @notice 链下计算哈希的辅助函数（也可在链下用 ethers.js 的 keccak256 计算）
    function computeHash(bytes calldata rawData) external pure returns (bytes32) {
        return keccak256(rawData);
    }
}
