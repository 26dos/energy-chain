package types

var (
	EnergyDataKeyPrefix      = []byte{0x01} // prefix for energy data by ID
	EnergyByCategoryPrefix   = []byte{0x02} // prefix for index: category -> ID
	EnergyBySubmitterPrefix  = []byte{0x03} // prefix for index: submitter -> ID
	BatchSubmissionKeyPrefix = []byte{0x04} // prefix for batch submission by ID
	DataCounterKey           = []byte{0x05} // key for the auto-increment data counter
)

// GetEnergyDataKey returns the store key for an energy data record: 0x01 | id
func GetEnergyDataKey(id string) []byte {
	return append(EnergyDataKeyPrefix, []byte(id)...)
}

// GetEnergyByCategoryKey returns the index key: 0x02 | category | 0x00 | id
func GetEnergyByCategoryKey(category, id string) []byte {
	key := append(EnergyByCategoryPrefix, []byte(category)...)
	key = append(key, 0x00)
	return append(key, []byte(id)...)
}

// GetEnergyByCategoryPrefixKey returns the prefix for iterating all records of a given category.
func GetEnergyByCategoryPrefixKey(category string) []byte {
	key := append(EnergyByCategoryPrefix, []byte(category)...)
	return append(key, 0x00)
}

// GetEnergyBySubmitterKey returns the index key: 0x03 | submitter | 0x00 | id
func GetEnergyBySubmitterKey(submitter, id string) []byte {
	key := append(EnergyBySubmitterPrefix, []byte(submitter)...)
	key = append(key, 0x00)
	return append(key, []byte(id)...)
}

// GetEnergyBySubmitterPrefixKey returns the prefix for iterating all records by a submitter.
func GetEnergyBySubmitterPrefixKey(submitter string) []byte {
	key := append(EnergyBySubmitterPrefix, []byte(submitter)...)
	return append(key, 0x00)
}

// GetBatchSubmissionKey returns the store key for a batch submission: 0x04 | id
func GetBatchSubmissionKey(id string) []byte {
	return append(BatchSubmissionKeyPrefix, []byte(id)...)
}
