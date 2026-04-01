package types

import "encoding/binary"

const (
	ModuleName   = "audit"
	StoreKey     = ModuleName
	RouterKey    = ModuleName
	QuerierRoute = ModuleName
)

var (
	AuditLogKey     = []byte{0x01} // primary: 0x01 | id(8)
	AuditByActorKey = []byte{0x02} // index:   0x02 | actor | 0x00 | id(8)
	AuditByTypeKey  = []byte{0x03} // index:   0x03 | event_type | 0x00 | id(8)
	AuditCounterKey = []byte{0x04}
	AuditByTimeKey  = []byte{0x05} // index:   0x05 | timestamp(8) | id(8)
	ParamsKey       = []byte{0x06}
)

func uint64ToBytes(v uint64) []byte {
	bz := make([]byte, 8)
	binary.BigEndian.PutUint64(bz, v)
	return bz
}

func bytesToUint64(bz []byte) uint64 {
	return binary.BigEndian.Uint64(bz)
}

func GetAuditLogKey(id uint64) []byte {
	return append(AuditLogKey, uint64ToBytes(id)...)
}

func GetAuditByActorKey(actor string, id uint64) []byte {
	key := append(AuditByActorKey, []byte(actor)...)
	key = append(key, 0x00)
	return append(key, uint64ToBytes(id)...)
}

func GetAuditByActorPrefixKey(actor string) []byte {
	key := append(AuditByActorKey, []byte(actor)...)
	return append(key, 0x00)
}

// GetAuditByTypeKey returns the index key: 0x03 | event_type | 0x00 | id(8)
func GetAuditByTypeKey(eventType string, id uint64) []byte {
	key := append(AuditByTypeKey, []byte(eventType)...)
	key = append(key, 0x00)
	return append(key, uint64ToBytes(id)...)
}

// GetAuditByTypePrefixKey returns the prefix for iterating by event type string.
func GetAuditByTypePrefixKey(eventType string) []byte {
	key := append(AuditByTypeKey, []byte(eventType)...)
	return append(key, 0x00)
}

func GetAuditByTimeKey(timestamp int64, id uint64) []byte {
	key := append(AuditByTimeKey, uint64ToBytes(uint64(timestamp))...)
	return append(key, uint64ToBytes(id)...)
}

func GetAuditByTimePrefixKey(timestamp int64) []byte {
	return append(AuditByTimeKey, uint64ToBytes(uint64(timestamp))...)
}

func GetAuditByTimeRangeEndKey(toTimestamp int64) []byte {
	return append(AuditByTimeKey, uint64ToBytes(uint64(toTimestamp+1))...)
}
