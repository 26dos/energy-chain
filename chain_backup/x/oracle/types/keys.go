package types

import (
	"encoding/binary"
)

var (
	PriceDataKeyPrefix   = []byte{0x01} // prefix for historical price entries
	OracleInfoKeyPrefix  = []byte{0x02} // prefix for oracle info by address
	LatestPriceKeyPrefix = []byte{0x03} // prefix for latest price per data type
)

// GetPriceDataKey returns the store key for a price entry: 0x01 | dataType(4) | timestamp(8)
func GetPriceDataKey(dataType DataType, timestamp int64) []byte {
	key := make([]byte, 1+4+8)
	key[0] = PriceDataKeyPrefix[0]
	binary.BigEndian.PutUint32(key[1:5], uint32(dataType))
	binary.BigEndian.PutUint64(key[5:13], uint64(timestamp))
	return key
}

// GetPriceDataPrefixByType returns the prefix for iterating all prices of a given type.
func GetPriceDataPrefixByType(dataType DataType) []byte {
	key := make([]byte, 1+4)
	key[0] = PriceDataKeyPrefix[0]
	binary.BigEndian.PutUint32(key[1:5], uint32(dataType))
	return key
}

// GetOracleKey returns the store key for an oracle: 0x02 | address bytes
func GetOracleKey(address string) []byte {
	return append(OracleInfoKeyPrefix, []byte(address)...)
}

// GetLatestPriceKey returns the store key for the latest price of a data type: 0x03 | dataType(4)
func GetLatestPriceKey(dataType DataType) []byte {
	key := make([]byte, 1+4)
	key[0] = LatestPriceKeyPrefix[0]
	binary.BigEndian.PutUint32(key[1:5], uint32(dataType))
	return key
}
