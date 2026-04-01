package types

// AuditEventType classifies the kind of on-chain event being recorded.
type AuditEventType int32

const (
	EventContractDeploy   AuditEventType = iota // Smart-contract deployment
	EventLargeTransfer                           // Transfer exceeding the threshold
	EventIdentityChange                          // Identity register / update / revoke
	EventOracleSubmission                        // Oracle price data submission
	EventGovernanceAction                        // Governance proposal / vote
	EventStakingAction                           // Delegation / unbonding / redelegation
	EventCustom                                  // Application-defined custom event
)

func (e AuditEventType) String() string {
	switch e {
	case EventContractDeploy:
		return "contract_deploy"
	case EventLargeTransfer:
		return "large_transfer"
	case EventIdentityChange:
		return "identity_change"
	case EventOracleSubmission:
		return "oracle_submission"
	case EventGovernanceAction:
		return "governance_action"
	case EventStakingAction:
		return "staking_action"
	case EventCustom:
		return "custom"
	default:
		return "unknown"
	}
}

// AuditEventTypeFromString converts a string back to AuditEventType.
// Returns EventCustom and false if the string is not recognised.
func AuditEventTypeFromString(s string) (AuditEventType, bool) {
	switch s {
	case "contract_deploy":
		return EventContractDeploy, true
	case "large_transfer":
		return EventLargeTransfer, true
	case "identity_change":
		return EventIdentityChange, true
	case "oracle_submission":
		return EventOracleSubmission, true
	case "governance_action":
		return EventGovernanceAction, true
	case "staking_action":
		return EventStakingAction, true
	case "custom":
		return EventCustom, true
	default:
		return EventCustom, false
	}
}

// IsValidAuditEventType returns true when the value falls within the defined range.
func IsValidAuditEventType(e AuditEventType) bool {
	return e >= EventContractDeploy && e <= EventCustom
}

// AuditLog is a single audit trail entry persisted on-chain.
type AuditLog struct {
	ID          uint64         `json:"id"`
	EventType   AuditEventType `json:"event_type"`
	Actor       string         `json:"actor"`
	Target      string         `json:"target"`
	Action      string         `json:"action"`
	Data        string         `json:"data"`
	BlockHeight int64          `json:"block_height"`
	Timestamp   int64          `json:"timestamp"`
	TxHash      string         `json:"tx_hash"`
}
