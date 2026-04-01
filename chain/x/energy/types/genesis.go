package types

import "fmt"

// Params defines the configurable parameters for the energy module.
type Params struct {
	MaxBatchSize      uint32   `json:"max_batch_size"`
	AllowedSubmitters []string `json:"allowed_submitters"` // empty means anyone can submit
}

func DefaultParams() Params {
	return Params{
		MaxBatchSize:      100,
		AllowedSubmitters: []string{},
	}
}

func (p Params) Validate() error {
	if p.MaxBatchSize == 0 {
		return fmt.Errorf("max_batch_size must be positive")
	}
	return nil
}

// GenesisState defines the energy module's genesis state.
type GenesisState struct {
	DataRecords []EnergyData      `json:"data_records"`
	Batches     []BatchSubmission `json:"batches"`
	Params      Params            `json:"params"`
}

func DefaultGenesis() *GenesisState {
	return &GenesisState{
		DataRecords: []EnergyData{},
		Batches:     []BatchSubmission{},
		Params:      DefaultParams(),
	}
}

func (gs GenesisState) Validate() error {
	if err := gs.Params.Validate(); err != nil {
		return fmt.Errorf("invalid params: %w", err)
	}

	ids := make(map[string]bool)
	for i, d := range gs.DataRecords {
		if d.ID == "" {
			return fmt.Errorf("data record %d has empty id", i)
		}
		if ids[d.ID] {
			return fmt.Errorf("duplicate data record id: %s", d.ID)
		}
		ids[d.ID] = true
		if d.Category == "" {
			return fmt.Errorf("data record %s has empty category", d.ID)
		}
		if d.DataHash == "" {
			return fmt.Errorf("data record %s has empty data hash", d.ID)
		}
		if d.Submitter == "" {
			return fmt.Errorf("data record %s has empty submitter", d.ID)
		}
	}

	batchIDs := make(map[string]bool)
	for i, b := range gs.Batches {
		if b.ID == "" {
			return fmt.Errorf("batch %d has empty id", i)
		}
		if batchIDs[b.ID] {
			return fmt.Errorf("duplicate batch id: %s", b.ID)
		}
		batchIDs[b.ID] = true
	}

	return nil
}
