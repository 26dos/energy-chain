export const CONTRACT_ABI = [
  "event DataAttested(uint256 indexed id, bytes32 indexed dataHash, address indexed submitter, string dataType, uint64 timestamp, uint64 blockNumber)",
  "function attest(bytes32 dataHash, string dataType, string memo) returns (uint256 id)",
  "function batchAttest(bytes32[] dataHashes, string dataType, string memo) returns (uint256 startId)",
  "function computeHash(bytes rawData) pure returns (bytes32)",
  "function getAttestation(uint256 id) view returns (tuple(bytes32 dataHash, address submitter, uint64 timestamp, uint64 blockNumber, string dataType, string memo))",
  "function getAttestationsBySubmitter(address submitter) view returns (uint256[])",
  "function getAttestationsByType(string dataType) view returns (uint256[])",
  "function totalAttestations() view returns (uint256)",
  "function verifyByHash(bytes32 dataHash) view returns (bool exists, tuple(bytes32 dataHash, address submitter, uint64 timestamp, uint64 blockNumber, string dataType, string memo) a)",
];
