package types

import "fmt"

type Params struct {
	LargeTransferThreshold uint64 `json:"large_transfer_threshold"`
	RetentionBlocks        int64  `json:"retention_blocks"`
}

func DefaultParams() Params {
	return Params{
		LargeTransferThreshold: 1_000_000,
		RetentionBlocks:        0,
	}
}

func (p Params) Validate() error {
	if p.RetentionBlocks < 0 {
		return fmt.Errorf("retention_blocks must be non-negative, got %d", p.RetentionBlocks)
	}
	return nil
}

type GenesisState struct {
	Logs    []AuditLog `json:"logs"`
	Counter uint64     `json:"counter"`
	Params  Params     `json:"params"`
}

func DefaultGenesis() *GenesisState {
	return &GenesisState{
		Logs:    []AuditLog{},
		Counter: 0,
		Params:  DefaultParams(),
	}
}

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
		if log.EventType == "" {
			return fmt.Errorf("audit log %d has empty event_type", log.ID)
		}
	}
	return nil
}
