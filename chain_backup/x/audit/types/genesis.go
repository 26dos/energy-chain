package types

import "fmt"

// Params holds the module-level parameters for the audit module.
type Params struct {
	// LargeTransferThreshold is the minimum transfer amount (in base denom)
	// that automatically triggers an EventLargeTransfer audit log.
	LargeTransferThreshold uint64 `json:"large_transfer_threshold"`

	// RetentionBlocks is the number of blocks to retain audit logs. Zero
	// means logs are kept indefinitely.
	RetentionBlocks int64 `json:"retention_blocks"`
}

// DefaultParams returns default module parameters.
func DefaultParams() Params {
	return Params{
		LargeTransferThreshold: 1_000_000,
		RetentionBlocks:        0,
	}
}

// Validate performs basic validation of module parameters.
func (p Params) Validate() error {
	if p.RetentionBlocks < 0 {
		return fmt.Errorf("retention_blocks must be non-negative, got %d", p.RetentionBlocks)
	}
	return nil
}

// GenesisState defines the audit module's genesis state.
type GenesisState struct {
	Logs    []AuditLog `json:"logs"`
	Counter uint64     `json:"counter"`
	Params  Params     `json:"params"`
}

// DefaultGenesis returns the default genesis state.
func DefaultGenesis() *GenesisState {
	return &GenesisState{
		Logs:    []AuditLog{},
		Counter: 0,
		Params:  DefaultParams(),
	}
}

// Validate performs basic genesis state validation.
func (gs GenesisState) Validate() error {
	if err := gs.Params.Validate(); err != nil {
		return fmt.Errorf("invalid params: %w", err)
	}

	seen := make(map[uint64]bool)
	for i, log := range gs.Logs {
		if seen[log.ID] {
			return fmt.Errorf("duplicate audit log ID %d at index %d", log.ID, i)
		}
		seen[log.ID] = true

		if log.Actor == "" {
			return fmt.Errorf("audit log %d has empty actor", log.ID)
		}
		if log.Action == "" {
			return fmt.Errorf("audit log %d has empty action", log.ID)
		}
		if !IsValidAuditEventType(log.EventType) {
			return fmt.Errorf("audit log %d has invalid event type: %d", log.ID, log.EventType)
		}
	}
	return nil
}
