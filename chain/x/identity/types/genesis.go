package types

import "fmt"

type Params struct {
	AdminAddress string `json:"admin_address"`
}

func DefaultParams() Params {
	return Params{
		AdminAddress: "",
	}
}

type GenesisState struct {
	Identities []Identity `json:"identities"`
	Params     Params     `json:"params"`
}

func DefaultGenesis() *GenesisState {
	return &GenesisState{
		Identities: []Identity{},
		Params:     DefaultParams(),
	}
}

func (gs GenesisState) Validate() error {
	seen := make(map[string]bool)
	for i, id := range gs.Identities {
		if id.Address == "" {
			return fmt.Errorf("identity at index %d has empty address", i)
		}
		if seen[id.Address] {
			return fmt.Errorf("duplicate identity address: %s", id.Address)
		}
		seen[id.Address] = true
		if id.Name == "" {
			return fmt.Errorf("identity %s has empty name", id.Address)
		}
		if id.Role == "" {
			return fmt.Errorf("identity %s has empty role", id.Address)
		}
		if id.Status == "" {
			return fmt.Errorf("identity %s has empty status", id.Address)
		}
	}
	return nil
}
