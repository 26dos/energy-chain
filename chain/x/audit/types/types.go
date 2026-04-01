package types

// AuditLog is a single audit trail entry persisted on-chain.
// The chain does NOT restrict what event types are valid — users define their own
// (e.g. "contract_deploy", "large_transfer", "custom", "governance_action", etc.).
type AuditLog struct {
	ID          uint64 `json:"id"`
	EventType   string `json:"event_type"`           // user-defined event type string
	Actor       string `json:"actor"`
	Target      string `json:"target,omitempty"`
	Action      string `json:"action"`
	Data        string `json:"data,omitempty"`        // free-form JSON payload
	BlockHeight int64  `json:"block_height"`
	Timestamp   int64  `json:"timestamp"`
	TxHash      string `json:"tx_hash,omitempty"`
}
