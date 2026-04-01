package types

import "fmt"

// Params defines the configurable parameters for the oracle module.
type Params struct {
	MinSubmissions uint32 `json:"min_submissions"` // Min submissions before aggregation
	PriceMaxAge    int64  `json:"price_max_age"`   // Max age in seconds before a price is considered stale
}

func DefaultParams() Params {
	return Params{
		MinSubmissions: 1,
		PriceMaxAge:    3600, // 1 hour
	}
}

func (p Params) Validate() error {
	if p.MinSubmissions == 0 {
		return fmt.Errorf("min_submissions must be positive")
	}
	if p.PriceMaxAge <= 0 {
		return fmt.Errorf("price_max_age must be positive")
	}
	return nil
}

// GenesisState defines the oracle module's genesis state.
type GenesisState struct {
	Oracles []OracleInfo `json:"oracles"`
	Prices  []PriceData  `json:"prices"`
	Params  Params       `json:"params"`
}

func DefaultGenesis() *GenesisState {
	return &GenesisState{
		Oracles: []OracleInfo{},
		Prices:  []PriceData{},
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
		for _, dt := range o.AuthorizedTypes {
			if !IsValidDataType(dt) {
				return fmt.Errorf("oracle %s has invalid data type: %d", o.Address, dt)
			}
		}
	}

	for i, p := range gs.Prices {
		if !IsValidDataType(p.DataType) {
			return fmt.Errorf("price %d has invalid data type: %d", i, p.DataType)
		}
		if p.Value == 0 {
			return fmt.Errorf("price %d has zero value", i)
		}
		if p.Timestamp <= 0 {
			return fmt.Errorf("price %d has invalid timestamp", i)
		}
	}

	return nil
}
