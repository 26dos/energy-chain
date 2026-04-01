package types

// Conventional status values used by the module's lifecycle logic.
// These are plain strings — no enum, no range check.
const (
	StatusPending = "pending"
	StatusActive  = "active"
	StatusRevoked = "revoked"
)

// Identity represents a registered participant in the energy chain.
// The chain does NOT restrict what roles are valid — users define their own
// (e.g. "vpp", "retail_company", "ev_operator", "prosumer", "regulator", etc.).
type Identity struct {
	Address      string `json:"address"`
	Name         string `json:"name"`
	Role         string `json:"role"`               // user-defined role string
	Status       string `json:"status"`              // "pending" | "active" | "revoked" (module-managed)
	Metadata     string `json:"metadata,omitempty"`  // optional free-form JSON
	RegisteredAt int64  `json:"registered_at"`
	UpdatedAt    int64  `json:"updated_at"`
}
