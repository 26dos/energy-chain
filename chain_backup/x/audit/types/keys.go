package types

import "encoding/binary"

const (
	ModuleName   = "audit"
	StoreKey     = ModuleName
	RouterKey    = ModuleName
	QuerierRoute = ModuleName
)

var (
	// AuditLogKey stores audit logs keyed by ID (big-endian uint64).
	// Layout: 0x01 | id (8 bytes) -> AuditLog
	AuditLogKey = []byte{0x01}

	// AuditByActorKey is a secondary index for lookups by actor address.
	// Layout: 0x02 | actor | 0x00 | id (8 bytes) -> []byte{0x01}
	AuditByActorKey = []byte{0x02}

	// AuditByTypeKey is a secondary index for lookups by event type.
	// Layout: 0x03 | event_type (1 byte) | id (8 bytes) -> []byte{0x01}
	AuditByTypeKey = []byte{0x03}

	// AuditCounterKey stores the auto-increment counter for audit log IDs.
	AuditCounterKey = []byte{0x04}

	// AuditByTimeKey is a secondary index for time-ordered range queries.
	// Layout: 0x05 | timestamp (8 bytes big-endian) | id (8 bytes) -> []byte{0x01}
	AuditByTimeKey = []byte{0x05}

	// ParamsKey stores the module parameters.
	ParamsKey = []byte{0x06}
)

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

func uint64ToBytes(v uint64) []byte {
	bz := make([]byte, 8)
	binary.BigEndian.PutUint64(bz, v)
	return bz
}

func bytesToUint64(bz []byte) uint64 {
	return binary.BigEndian.Uint64(bz)
}

// GetAuditLogKey returns the primary store key for an audit log by ID.
func GetAuditLogKey(id uint64) []byte {
	return append(AuditLogKey, uint64ToBytes(id)...)
}

// GetAuditByActorKey returns the full index key for an actor's audit log entry.
func GetAuditByActorKey(actor string, id uint64) []byte {
	key := append(AuditByActorKey, []byte(actor)...)
	key = append(key, 0x00) // separator
	return append(key, uint64ToBytes(id)...)
}

// GetAuditByActorPrefixKey returns the prefix for iterating all logs by a given actor.
func GetAuditByActorPrefixKey(actor string) []byte {
	key := append(AuditByActorKey, []byte(actor)...)
	return append(key, 0x00)
}

// GetAuditByTypeKey returns the full index key for an event-type entry.
func GetAuditByTypeKey(eventType AuditEventType, id uint64) []byte {
	key := append(AuditByTypeKey, byte(eventType))
	return append(key, uint64ToBytes(id)...)
}

// GetAuditByTypePrefixKey returns the prefix for iterating all logs of a given type.
func GetAuditByTypePrefixKey(eventType AuditEventType) []byte {
	return append(AuditByTypeKey, byte(eventType))
}

// GetAuditByTimeKey returns the full index key for a time-ordered entry.
func GetAuditByTimeKey(timestamp int64, id uint64) []byte {
	key := append(AuditByTimeKey, uint64ToBytes(uint64(timestamp))...)
	return append(key, uint64ToBytes(id)...)
}

// GetAuditByTimePrefixKey returns the prefix for iterating logs from a given timestamp.
func GetAuditByTimePrefixKey(timestamp int64) []byte {
	return append(AuditByTimeKey, uint64ToBytes(uint64(timestamp))...)
}

// GetAuditByTimeRangeEndKey returns the exclusive upper-bound key for a time range query.
func GetAuditByTimeRangeEndKey(toTimestamp int64) []byte {
	return append(AuditByTimeKey, uint64ToBytes(uint64(toTimestamp+1))...)
}
