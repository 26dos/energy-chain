package types

// RoleType represents the participant role in the energy market.
type RoleType int32

const (
	RoleUser             RoleType = iota // End consumer / prosumer
	RoleRetailCompany                    // Retail electricity company (售电公司)
	RoleVPP                              // Virtual Power Plant aggregator (虚拟电厂)
	RoleChargingOperator                 // EV charging station operator (充电桩运营商)
	RoleGridOperator                     // Grid / transmission operator (电网)
	RoleRegulator                        // Regulatory authority (监管方)
)

func (r RoleType) String() string {
	switch r {
	case RoleUser:
		return "user"
	case RoleRetailCompany:
		return "retail_company"
	case RoleVPP:
		return "vpp"
	case RoleChargingOperator:
		return "charging_operator"
	case RoleGridOperator:
		return "grid_operator"
	case RoleRegulator:
		return "regulator"
	default:
		return "unknown"
	}
}

// RoleTypeFromString converts a string to RoleType. Returns RoleUser and false
// if the string does not match any known role.
func RoleTypeFromString(s string) (RoleType, bool) {
	switch s {
	case "user":
		return RoleUser, true
	case "retail_company":
		return RoleRetailCompany, true
	case "vpp":
		return RoleVPP, true
	case "charging_operator":
		return RoleChargingOperator, true
	case "grid_operator":
		return RoleGridOperator, true
	case "regulator":
		return RoleRegulator, true
	default:
		return RoleUser, false
	}
}

// IdentityStatus represents the KYC/whitelist status of a registered identity.
type IdentityStatus int32

const (
	StatusPending IdentityStatus = iota // Awaiting KYC approval
	StatusActive                        // Approved and active
	StatusRevoked                       // Access revoked
)

func (s IdentityStatus) String() string {
	switch s {
	case StatusPending:
		return "pending"
	case StatusActive:
		return "active"
	case StatusRevoked:
		return "revoked"
	default:
		return "unknown"
	}
}

// Identity represents a registered participant in the energy chain.
type Identity struct {
	Address      string         `json:"address"`
	Name         string         `json:"name"`
	Role         RoleType       `json:"role"`
	Status       IdentityStatus `json:"status"`
	Metadata     string         `json:"metadata"`
	RegisteredAt int64          `json:"registered_at"`
	UpdatedAt    int64          `json:"updated_at"`
}
