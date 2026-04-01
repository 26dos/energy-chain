package types

const (
	ModuleName = "oracle"
	StoreKey   = ModuleName
	RouterKey  = ModuleName
)

// OracleData represents a single oracle data submission.
// The chain does NOT constrain what categories or value formats are valid —
// oracle operators define their own categories (e.g. "spot_price", "weather", "carbon_price")
// and value encoding (numeric string, JSON, etc.).
type OracleData struct {
	Category    string `json:"category"`              // user-defined, e.g. "spot_price", "load_forecast"
	Value       string `json:"value"`                 // free-form: number, JSON object, etc.
	Metadata    string `json:"metadata,omitempty"`     // optional context (unit, region, source, etc.)
	Timestamp   int64  `json:"timestamp"`
	Submitter   string `json:"submitter"`
	BlockHeight int64  `json:"block_height"`
}

// OracleInfo describes an authorized oracle node.
type OracleInfo struct {
	Address              string   `json:"address"`
	Name                 string   `json:"name"`
	Active               bool     `json:"active"`
	AuthorizedCategories []string `json:"authorized_categories"` // empty = authorized for all
}

// IsAuthorizedFor checks whether the oracle is active and authorized for the given category.
// An empty AuthorizedCategories list means the oracle can submit any category.
func (o OracleInfo) IsAuthorizedFor(category string) bool {
	if !o.Active {
		return false
	}
	if len(o.AuthorizedCategories) == 0 {
		return true
	}
	for _, c := range o.AuthorizedCategories {
		if c == category {
			return true
		}
	}
	return false
}
