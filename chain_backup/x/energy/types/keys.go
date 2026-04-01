package types

import (
	"encoding/binary"
)

var (
	EnergyDataKeyPrefix      = []byte{0x01} // prefix for energy data by ID
	EnergyByTypeKeyPrefix    = []byte{0x02} // prefix for index: dataType -> ID
	EnergyBySubmitterPrefix  = []byte{0x03} // prefix for index: submitter -> ID
	BatchSubmissionKeyPrefix = []byte{0x04} // prefix for batch submission by ID
	DataCounterKey           = []byte{0x05} // key for the auto-increment data counter
)

// GetEnergyDataKey returns the store key for an energy data record: 0x01 | id
func GetEnergyDataKey(id string) []byte {
	return append(EnergyDataKeyPrefix, []byte(id)...)
}

// GetEnergyByTypeKey returns the index key: 0x02 | dataType(4) | id
func GetEnergyByTypeKey(dataType EnergyDataType, id string) []byte {
	key := make([]byte, 1+4)
	key[0] = EnergyByTypeKeyPrefix[0]
	binary.BigEndian.PutUint32(key[1:5], uint32(dataType))
	return append(key, []byte(id)...)
}

// GetEnergyByTypePrefixKey returns the prefix for iterating all records of a given type: 0x02 | dataType(4)
func GetEnergyByTypePrefixKey(dataType EnergyDataType) []byte {
	key := make([]byte, 1+4)
	key[0] = EnergyByTypeKeyPrefix[0]
	binary.BigEndian.PutUint32(key[1:5], uint32(dataType))
	return key
}

// GetEnergyBySubmitterKey returns the index key: 0x03 | submitter | "/" | id
func GetEnergyBySubmitterKey(submitter, id string) []byte {
	prefix := append(EnergyBySubmitterPrefix, []byte(submitter)...)
	prefix = append(prefix, '/')
	return append(prefix, []byte(id)...)
}

// GetEnergyBySubmitterPrefixKey returns the prefix for iterating all records by a submitter: 0x03 | submitter | "/"
func GetEnergyBySubmitterPrefixKey(submitter string) []byte {
	prefix := append(EnergyBySubmitterPrefix, []byte(submitter)...)
	return append(prefix, '/')
}

// GetBatchSubmissionKey returns the store key for a batch submission: 0x04 | id
func GetBatchSubmissionKey(id string) []byte {
	return append(BatchSubmissionKeyPrefix, []byte(id)...)
}
