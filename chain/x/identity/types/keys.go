package types

const (
	ModuleName   = "identity"
	StoreKey     = ModuleName
	RouterKey    = ModuleName
	QuerierRoute = ModuleName
)

var (
	IdentityKey       = []byte{0x01} // prefix for identity by address
	IdentityByRoleKey = []byte{0x02} // prefix for role index: role | 0x00 | address
)

func GetIdentityKey(address string) []byte {
	return append(IdentityKey, []byte(address)...)
}

// GetIdentityByRoleKey returns the index key: 0x02 | role | 0x00 | address
func GetIdentityByRoleKey(role, address string) []byte {
	key := append(IdentityByRoleKey, []byte(role)...)
	key = append(key, 0x00)
	return append(key, []byte(address)...)
}

// GetIdentityByRolePrefixKey returns the prefix for iterating all identities with a given role.
func GetIdentityByRolePrefixKey(role string) []byte {
	key := append(IdentityByRoleKey, []byte(role)...)
	return append(key, 0x00)
}
