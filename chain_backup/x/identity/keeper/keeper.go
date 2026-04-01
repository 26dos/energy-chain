package keeper

import (
	"encoding/json"

	"cosmossdk.io/store/prefix"
	storetypes "cosmossdk.io/store/types"
	"github.com/cosmos/cosmos-sdk/codec"
	sdk "github.com/cosmos/cosmos-sdk/types"

	"energychain/x/identity/types"
)

// Keeper maintains the link to data storage and exposes getter/setter methods
// for the identity module's KV store.
type Keeper struct {
	cdc       codec.Codec
	storeKey  storetypes.StoreKey
	authority string // bech32 admin address authorized for privileged operations
}

// NewKeeper creates a new identity Keeper instance.
func NewKeeper(cdc codec.Codec, storeKey storetypes.StoreKey, authority string) Keeper {
	return Keeper{
		cdc:       cdc,
		storeKey:  storeKey,
		authority: authority,
	}
}

// GetAuthority returns the module's authority address (admin).
func (k Keeper) GetAuthority() string {
	return k.authority
}

// ---------------------------------------------------------------------------
// Identity CRUD
// ---------------------------------------------------------------------------

// SetIdentity stores an identity in the KV store and updates the role index.
func (k Keeper) SetIdentity(ctx sdk.Context, identity types.Identity) {
	store := ctx.KVStore(k.storeKey)

	bz, err := json.Marshal(identity)
	if err != nil {
		panic(err)
	}

	store.Set(types.GetIdentityKey(identity.Address), bz)
	store.Set(types.GetIdentityByRoleKey(identity.Role, identity.Address), []byte{0x01})
}

// GetIdentity retrieves an identity by address. Returns the identity and
// whether it was found.
func (k Keeper) GetIdentity(ctx sdk.Context, address string) (types.Identity, bool) {
	store := ctx.KVStore(k.storeKey)
	bz := store.Get(types.GetIdentityKey(address))
	if bz == nil {
		return types.Identity{}, false
	}

	var identity types.Identity
	if err := json.Unmarshal(bz, &identity); err != nil {
		panic(err)
	}
	return identity, true
}

// DeleteIdentity removes an identity and its role index entry from the store.
func (k Keeper) DeleteIdentity(ctx sdk.Context, address string) {
	identity, found := k.GetIdentity(ctx, address)
	if !found {
		return
	}

	store := ctx.KVStore(k.storeKey)
	store.Delete(types.GetIdentityKey(address))
	store.Delete(types.GetIdentityByRoleKey(identity.Role, address))
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// GetIdentitiesByRole returns all identities with the given role.
func (k Keeper) GetIdentitiesByRole(ctx sdk.Context, role types.RoleType) []types.Identity {
	store := ctx.KVStore(k.storeKey)
	prefixStore := prefix.NewStore(store, types.GetIdentityByRolePrefixKey(role))

	var identities []types.Identity
	iter := prefixStore.Iterator(nil, nil)
	defer iter.Close()

	for ; iter.Valid(); iter.Next() {
		// The key suffix is the address; look up the full identity.
		address := string(iter.Key())
		identity, found := k.GetIdentity(ctx, address)
		if found {
			identities = append(identities, identity)
		}
	}
	return identities
}

// GetAllIdentities returns every registered identity.
func (k Keeper) GetAllIdentities(ctx sdk.Context) []types.Identity {
	store := ctx.KVStore(k.storeKey)
	prefixStore := prefix.NewStore(store, types.IdentityKey)

	var identities []types.Identity
	iter := prefixStore.Iterator(nil, nil)
	defer iter.Close()

	for ; iter.Valid(); iter.Next() {
		var identity types.Identity
		if err := json.Unmarshal(iter.Value(), &identity); err != nil {
			panic(err)
		}
		identities = append(identities, identity)
	}
	return identities
}

// IsRegistered returns true if an identity exists for the given address
// (regardless of status).
func (k Keeper) IsRegistered(ctx sdk.Context, address string) bool {
	store := ctx.KVStore(k.storeKey)
	return store.Has(types.GetIdentityKey(address))
}

// HasRole returns true if the address has a registered identity with the
// specified role and is in active status.
func (k Keeper) HasRole(ctx sdk.Context, address string, role types.RoleType) bool {
	identity, found := k.GetIdentity(ctx, address)
	if !found {
		return false
	}
	return identity.Role == role && identity.Status == types.StatusActive
}
