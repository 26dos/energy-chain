package types

const (
	ModuleName = "energy"
	StoreKey   = ModuleName
	RouterKey  = ModuleName
)

// EnergyData represents a single on-chain energy data attestation.
// The chain does NOT define what categories or metadata fields are valid —
// users are free to submit any category string and any JSON metadata.
// Only the hash of the off-chain payload is stored; the full data lives off-chain.
type EnergyData struct {
	ID          string `json:"id"`
	Category    string `json:"category"`           // user-defined category (e.g. "meter", "vpp_contract", "ev_charging")
	Submitter   string `json:"submitter"`
	DataHash    string `json:"data_hash"`
	Metadata    string `json:"metadata,omitempty"`  // optional free-form JSON (source_id, period, summary, etc.)
	BlockHeight int64  `json:"block_height"`
	Timestamp   int64  `json:"timestamp"`
}

// BatchSubmission records a batch of energy data submissions grouped under one merkle root.
type BatchSubmission struct {
	ID         string `json:"id"`
	Submitter  string `json:"submitter"`
	Category   string `json:"category"`
	DataCount  uint32 `json:"data_count"`
	MerkleRoot string `json:"merkle_root"`
	Timestamp  int64  `json:"timestamp"`
}
