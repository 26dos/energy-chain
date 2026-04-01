package types

const (
	ModuleName = "energy"
	StoreKey   = ModuleName
	RouterKey  = ModuleName
)

// EnergyDataType represents the category of energy data being attested on-chain.
type EnergyDataType uint32

const (
	DataTypeMeter            EnergyDataType = iota // Smart meter readings
	DataTypeTradeSettlement                        // Electricity trade settlement records
	DataTypeVPPRegulation                          // Virtual power plant regulation events
	DataTypeChargingRecord                         // EV charging session records
	DataTypeGreenCert                              // Green electricity / REC certificates
	DataTypeCarbonEmission                         // Carbon emission reports
	DataTypeAuxiliaryService                       // Ancillary / auxiliary service records
)

func (d EnergyDataType) String() string {
	switch d {
	case DataTypeMeter:
		return "meter"
	case DataTypeTradeSettlement:
		return "trade_settlement"
	case DataTypeVPPRegulation:
		return "vpp_regulation"
	case DataTypeChargingRecord:
		return "charging_record"
	case DataTypeGreenCert:
		return "green_cert"
	case DataTypeCarbonEmission:
		return "carbon_emission"
	case DataTypeAuxiliaryService:
		return "auxiliary_service"
	default:
		return "unknown"
	}
}

func DataTypeFromString(s string) (EnergyDataType, bool) {
	switch s {
	case "meter":
		return DataTypeMeter, true
	case "trade_settlement":
		return DataTypeTradeSettlement, true
	case "vpp_regulation":
		return DataTypeVPPRegulation, true
	case "charging_record":
		return DataTypeChargingRecord, true
	case "green_cert":
		return DataTypeGreenCert, true
	case "carbon_emission":
		return DataTypeCarbonEmission, true
	case "auxiliary_service":
		return DataTypeAuxiliaryService, true
	default:
		return 0, false
	}
}

func IsValidDataType(d EnergyDataType) bool {
	return d <= DataTypeAuxiliaryService
}

// EnergyData represents a single on-chain energy data attestation.
// Only the hash of the off-chain data is stored; the full payload lives off-chain.
type EnergyData struct {
	ID          string         `json:"id"`
	DataType    EnergyDataType `json:"data_type"`
	Submitter   string         `json:"submitter"`
	DataHash    string         `json:"data_hash"`
	Summary     string         `json:"summary,omitempty"`
	SourceID    string         `json:"source_id"`
	Period      string         `json:"period"`
	BlockHeight int64          `json:"block_height"`
	Timestamp   int64          `json:"timestamp"`
}

// BatchSubmission records a batch of energy data submissions grouped under one merkle root.
type BatchSubmission struct {
	ID        string `json:"id"`
	Submitter string `json:"submitter"`
	DataCount uint32 `json:"data_count"`
	MerkleRoot string `json:"merkle_root"`
	Timestamp int64  `json:"timestamp"`
}
