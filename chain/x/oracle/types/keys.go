package types

import (
	"encoding/binary"
)

var (
	OracleDataKeyPrefix  = []byte{0x01} // prefix for historical oracle data
	OracleInfoKeyPrefix  = []byte{0x02} // prefix for oracle info by address
	LatestDataKeyPrefix  = []byte{0x03} // prefix for latest data per category
)

// GetOracleDataKey returns the store key: 0x01 | category | 0x00 | timestamp(8)
func GetOracleDataKey(category string, timestamp int64) []byte {
	key := append(OracleDataKeyPrefix, []byte(category)...)
	key = append(key, 0x00)
	ts := make([]byte, 8)
	binary.BigEndian.PutUint64(ts, uint64(timestamp))
	return append(key, ts...)
}

// GetOracleDataPrefixByCategory returns the prefix for iterating all data of a given category.
func GetOracleDataPrefixByCategory(category string) []byte {
	key := append(OracleDataKeyPrefix, []byte(category)...)
	return append(key, 0x00)
}

// GetOracleKey returns the store key for an oracle: 0x02 | address bytes
func GetOracleKey(address string) []byte {
	return append(OracleInfoKeyPrefix, []byte(address)...)
}

// GetLatestDataKey returns the store key for the latest data of a category: 0x03 | category
func GetLatestDataKey(category string) []byte {
	return append(LatestDataKeyPrefix, []byte(category)...)
}
