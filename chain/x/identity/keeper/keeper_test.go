package keeper_test

import (
	"testing"

	"cosmossdk.io/log/v2"
	"cosmossdk.io/store"
	storetypes "cosmossdk.io/store/types"
	cmtproto "github.com/cometbft/cometbft/proto/tendermint/types"
	dbm "github.com/cosmos/cosmos-db"
	"github.com/cosmos/cosmos-sdk/codec"
	codectypes "github.com/cosmos/cosmos-sdk/codec/types"
	sdk "github.com/cosmos/cosmos-sdk/types"

	"energychain/x/identity/keeper"
	"energychain/x/identity/types"
)

func setupKeeper(t *testing.T) (keeper.Keeper, sdk.Context) {
	t.Helper()

	storeKey := storetypes.NewKVStoreKey(types.StoreKey)
	db := dbm.NewMemDB()
	stateStore := store.NewCommitMultiStore(db, log.NewNopLogger())
	stateStore.MountStoreWithDB(storeKey, storetypes.StoreTypeIAVL, db)
	if err := stateStore.LoadLatestVersion(); err != nil {
		t.Fatal(err)
	}

	registry := codectypes.NewInterfaceRegistry()
	cdc := codec.NewProtoCodec(registry)

	k := keeper.NewKeeper(cdc, storeKey, "authority")
	ctx := sdk.NewContext(stateStore, cmtproto.Header{}, false, log.NewNopLogger())

	return k, ctx
}

func TestSetAndGetIdentity(t *testing.T) {
	k, ctx := setupKeeper(t)

	identity := types.Identity{
		Address:  "energy1alice",
		Name:     "Alice",
		Role:     "retail_company",
		Status:   types.StatusActive,
		Metadata: `{"license":"RC-2025-001"}`,
	}

	k.SetIdentity(ctx, identity)

	got, found := k.GetIdentity(ctx, "energy1alice")
	if !found {
		t.Fatal("expected to find identity")
	}
	if got.Name != "Alice" {
		t.Errorf("name: want Alice, got %s", got.Name)
	}
	if got.Role != "retail_company" {
		t.Errorf("role: want retail_company, got %s", got.Role)
	}
}

func TestGetIdentityNotFound(t *testing.T) {
	k, ctx := setupKeeper(t)

	_, found := k.GetIdentity(ctx, "nonexistent")
	if found {
		t.Fatal("expected not found")
	}
}

func TestDeleteIdentity(t *testing.T) {
	k, ctx := setupKeeper(t)

	k.SetIdentity(ctx, types.Identity{
		Address: "energy1alice", Name: "Alice", Role: "user", Status: types.StatusActive,
	})

	k.DeleteIdentity(ctx, "energy1alice")

	_, found := k.GetIdentity(ctx, "energy1alice")
	if found {
		t.Fatal("expected identity to be deleted")
	}
}

func TestIsRegistered(t *testing.T) {
	k, ctx := setupKeeper(t)

	if k.IsRegistered(ctx, "energy1alice") {
		t.Fatal("should not be registered initially")
	}

	k.SetIdentity(ctx, types.Identity{
		Address: "energy1alice", Name: "Alice", Role: "user", Status: types.StatusPending,
	})

	if !k.IsRegistered(ctx, "energy1alice") {
		t.Fatal("should be registered after SetIdentity")
	}
}

func TestHasRole(t *testing.T) {
	k, ctx := setupKeeper(t)

	k.SetIdentity(ctx, types.Identity{
		Address: "energy1alice", Name: "Alice", Role: "vpp", Status: types.StatusActive,
	})
	k.SetIdentity(ctx, types.Identity{
		Address: "energy1bob", Name: "Bob", Role: "vpp", Status: types.StatusRevoked,
	})

	if !k.HasRole(ctx, "energy1alice", "vpp") {
		t.Error("alice should have vpp role")
	}
	if k.HasRole(ctx, "energy1alice", "regulator") {
		t.Error("alice should not have regulator role")
	}
	if k.HasRole(ctx, "energy1bob", "vpp") {
		t.Error("bob is revoked, should not pass HasRole check")
	}
}

func TestGetIdentitiesByRole(t *testing.T) {
	k, ctx := setupKeeper(t)

	k.SetIdentity(ctx, types.Identity{Address: "a1", Name: "A1", Role: "vpp", Status: types.StatusActive})
	k.SetIdentity(ctx, types.Identity{Address: "a2", Name: "A2", Role: "user", Status: types.StatusActive})
	k.SetIdentity(ctx, types.Identity{Address: "a3", Name: "A3", Role: "vpp", Status: types.StatusActive})

	vpps := k.GetIdentitiesByRole(ctx, "vpp")
	if len(vpps) != 2 {
		t.Errorf("expected 2 vpp identities, got %d", len(vpps))
	}

	users := k.GetIdentitiesByRole(ctx, "user")
	if len(users) != 1 {
		t.Errorf("expected 1 user identity, got %d", len(users))
	}

	custom := k.GetIdentitiesByRole(ctx, "custom_role")
	if len(custom) != 0 {
		t.Errorf("expected 0 identities for unknown role, got %d", len(custom))
	}
}

func TestGetAllIdentities(t *testing.T) {
	k, ctx := setupKeeper(t)

	k.SetIdentity(ctx, types.Identity{Address: "a1", Name: "A1", Role: "user", Status: types.StatusActive})
	k.SetIdentity(ctx, types.Identity{Address: "a2", Name: "A2", Role: "vpp", Status: types.StatusActive})

	all := k.GetAllIdentities(ctx)
	if len(all) != 2 {
		t.Errorf("expected 2 total identities, got %d", len(all))
	}
}

func TestExportGenesis(t *testing.T) {
	k, ctx := setupKeeper(t)

	k.SetIdentity(ctx, types.Identity{Address: "a1", Name: "A1", Role: "user", Status: types.StatusActive})

	gs := k.ExportGenesis(ctx)
	if len(gs.Identities) != 1 {
		t.Errorf("exported identities: want 1, got %d", len(gs.Identities))
	}
}
