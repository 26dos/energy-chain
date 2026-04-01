package types

const (
	ModuleName = "oracle"
	StoreKey   = ModuleName
	RouterKey  = ModuleName
)

// DataType represents the category of oracle data being submitted.
type DataType uint32

const (
	DataTypeSpotPrice     DataType = iota // Real-time electricity spot price
	DataTypeDayAheadPrice                 // Day-ahead market clearing price
	DataTypeCarbonPrice                   // Carbon emission allowance price
	DataTypeLoadForecast                  // Grid load forecast data
	DataTypeWeather                       // Weather data affecting generation/demand
)

func (d DataType) String() string {
	switch d {
	case DataTypeSpotPrice:
		return "spot_price"
	case DataTypeDayAheadPrice:
		return "day_ahead_price"
	case DataTypeCarbonPrice:
		return "carbon_price"
	case DataTypeLoadForecast:
		return "load_forecast"
	case DataTypeWeather:
		return "weather"
	default:
		return "unknown"
	}
}

func DataTypeFromString(s string) (DataType, bool) {
	switch s {
	case "spot_price":
		return DataTypeSpotPrice, true
	case "day_ahead_price":
		return DataTypeDayAheadPrice, true
	case "carbon_price":
		return DataTypeCarbonPrice, true
	case "load_forecast":
		return DataTypeLoadForecast, true
	case "weather":
		return DataTypeWeather, true
	default:
		return 0, false
	}
}

func IsValidDataType(d DataType) bool {
	return d <= DataTypeWeather
}

// PriceData represents a single oracle data submission.
type PriceData struct {
	DataType    DataType `json:"data_type"`
	Value       uint64   `json:"value"`        // Price in smallest unit (e.g. 0.01 CNY/MWh)
	Timestamp   int64    `json:"timestamp"`     // Unix timestamp of the observation
	Submitter   string   `json:"submitter"`     // Bech32 address of the oracle node
	BlockHeight int64    `json:"block_height"`  // Block height at which this was recorded
}

// OracleInfo describes an authorized oracle node.
type OracleInfo struct {
	Address         string     `json:"address"`
	Name            string     `json:"name"`
	Active          bool       `json:"active"`
	AuthorizedTypes []DataType `json:"authorized_types"`
}

// IsAuthorizedFor checks whether the oracle is active and authorized for the given data type.
func (o OracleInfo) IsAuthorizedFor(dt DataType) bool {
	if !o.Active {
		return false
	}
	for _, t := range o.AuthorizedTypes {
		if t == dt {
			return true
		}
	}
	return false
}
