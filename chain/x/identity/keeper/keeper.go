package keeper

import (
	"encoding/json"

	"cosmossdk.io/store/prefix"
	storetypes "cosmossdk.io/store/types"
	"github.com/cosmos/cosmos-sdk/codec"
	sdk "github.com/cosmos/cosmos-sdk/types"

	"energychain/x/identity/types"
)

type Keeper struct {
	cdc       codec.Codec
	storeKey  storetypes.StoreKey
	authority string
}

func NewKeeper(cdc codec.Codec, storeKey storetypes.StoreKey, authority string) Keeper {
	return Keeper{
		cdc:       cdc,
		storeKey:  storeKey,
		authority: authority,
	}
}

func (k Keeper) GetAuthority() string {
	return k.authority
}

// ---------------------------------------------------------------------------
// Identity CRUD
// ---------------------------------------------------------------------------

func (k Keeper) SetIdentity(ctx sdk.Context, identity types.Identity) {
	store := ctx.KVStore(k.storeKey)

	bz, err := json.Marshal(identity)
	if err != nil {
		panic(err)
	}

	store.Set(types.GetIdentityKey(identity.Address), bz)
	store.Set(types.GetIdentityByRoleKey(identity.Role, identity.Address), []byte{0x01})
}

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

func (k Keeper) GetIdentitiesByRole(ctx sdk.Context, role string) []types.Identity {
	store := ctx.KVStore(k.storeKey)
	prefixStore := prefix.NewStore(store, types.GetIdentityByRolePrefixKey(role))

	var identities []types.Identity
	iter := prefixStore.Iterator(nil, nil)
	defer iter.Close()

	for ; iter.Valid(); iter.Next() {
		address := string(iter.Key())
		identity, found := k.GetIdentity(ctx, address)
		if found {
			identities = append(identities, identity)
		}
	}
	return identities
}

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

func (k Keeper) ExportGenesis(ctx sdk.Context) *types.GenesisState {
	return &types.GenesisState{
		Identities: k.GetAllIdentities(ctx),
		Params:     types.DefaultParams(),
	}
}

func (k Keeper) IsRegistered(ctx sdk.Context, address string) bool {
	store := ctx.KVStore(k.storeKey)
	return store.Has(types.GetIdentityKey(address))
}

// HasRole returns true if the address has an active identity with the specified role.
func (k Keeper) HasRole(ctx sdk.Context, address, role string) bool {
	identity, found := k.GetIdentity(ctx, address)
	if !found {
		return false
	}
	return identity.Role == role && identity.Status == types.StatusActive
}
