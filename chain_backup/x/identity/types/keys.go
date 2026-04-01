package types

const (
	ModuleName   = "identity"
	StoreKey     = ModuleName
	RouterKey    = ModuleName
	QuerierRoute = ModuleName
)

var (
	// IdentityKey is the prefix for storing identities keyed by address.
	// Store layout: IdentityKey | address -> Identity
	IdentityKey = []byte{0x01}

	// IdentityByRoleKey is the prefix for the role-based secondary index.
	// Store layout: IdentityByRoleKey | role (1 byte) | address -> []byte{0x01}
	IdentityByRoleKey = []byte{0x02}
)

// GetIdentityKey returns the store key for a specific identity by address.
func GetIdentityKey(address string) []byte {
	return append(IdentityKey, []byte(address)...)
}

// GetIdentityByRoleKey returns the store key for the role index entry.
func GetIdentityByRoleKey(role RoleType, address string) []byte {
	key := append(IdentityByRoleKey, byte(role))
	return append(key, []byte(address)...)
}

// GetIdentityByRolePrefixKey returns the prefix for iterating all identities
// with a given role.
func GetIdentityByRolePrefixKey(role RoleType) []byte {
	return append(IdentityByRoleKey, byte(role))
}
