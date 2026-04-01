package types

import "fmt"

// Params holds the module-level parameters for the identity module.
type Params struct {
	// AdminAddress is the bech32 address authorized to register/revoke identities.
	AdminAddress string `json:"admin_address"`
}

// DefaultParams returns default module parameters.
func DefaultParams() Params {
	return Params{
		AdminAddress: "",
	}
}

// GenesisState defines the identity module's genesis state.
type GenesisState struct {
	Identities []Identity `json:"identities"`
	Params     Params     `json:"params"`
}

// DefaultGenesis returns the default genesis state.
func DefaultGenesis() *GenesisState {
	return &GenesisState{
		Identities: []Identity{},
		Params:     DefaultParams(),
	}
}

// Validate performs basic genesis state validation.
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
		if id.Role < RoleUser || id.Role > RoleRegulator {
			return fmt.Errorf("identity %s has invalid role: %d", id.Address, id.Role)
		}
		if id.Status < StatusPending || id.Status > StatusRevoked {
			return fmt.Errorf("identity %s has invalid status: %d", id.Address, id.Status)
		}
	}
	return nil
}
