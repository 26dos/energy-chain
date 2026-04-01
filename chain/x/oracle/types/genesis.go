package types

import "fmt"

type Params struct {
	MinSubmissions uint32 `json:"min_submissions"`
	DataMaxAge     int64  `json:"data_max_age"` // seconds before data is considered stale
}

func DefaultParams() Params {
	return Params{
		MinSubmissions: 1,
		DataMaxAge:     3600,
	}
}

func (p Params) Validate() error {
	if p.MinSubmissions == 0 {
		return fmt.Errorf("min_submissions must be positive")
	}
	if p.DataMaxAge <= 0 {
		return fmt.Errorf("data_max_age must be positive")
	}
	return nil
}

type GenesisState struct {
	Oracles []OracleInfo `json:"oracles"`
	Data    []OracleData `json:"data"`
	Params  Params       `json:"params"`
}

func DefaultGenesis() *GenesisState {
	return &GenesisState{
		Oracles: []OracleInfo{},
		Data:    []OracleData{},
		Params:  DefaultParams(),
	}
}

func (gs GenesisState) Validate() error {
	if err := gs.Params.Validate(); err != nil {
		return fmt.Errorf("invalid params: %w", err)
	}

	oracleAddrs := make(map[string]bool)
	for i, o := range gs.Oracles {
		if o.Address == "" {
			return fmt.Errorf("oracle %d has empty address", i)
		}
		if oracleAddrs[o.Address] {
			return fmt.Errorf("duplicate oracle address: %s", o.Address)
		}
		oracleAddrs[o.Address] = true
		if o.Name == "" {
			return fmt.Errorf("oracle %d has empty name", i)
		}
	}

	for i, d := range gs.Data {
		if d.Category == "" {
			return fmt.Errorf("data %d has empty category", i)
		}
		if d.Value == "" {
			return fmt.Errorf("data %d has empty value", i)
		}
		if d.Timestamp <= 0 {
			return fmt.Errorf("data %d has invalid timestamp", i)
		}
	}

	return nil
}
