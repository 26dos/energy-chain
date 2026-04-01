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

	"energychain/x/energy/keeper"
	"energychain/x/energy/types"
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

func TestSubmitAndGetEnergyData(t *testing.T) {
	k, ctx := setupKeeper(t)

	data := types.EnergyData{
		ID:       "energy-1",
		Category: "meter",
		Submitter: "energy1abc",
		DataHash:  "0xdeadbeef",
		Metadata:  `{"source_id":"meter-001","period":"2025-01"}`,
	}

	k.SubmitEnergyData(ctx, data)

	got, found := k.GetEnergyData(ctx, "energy-1")
	if !found {
		t.Fatal("expected to find energy data")
	}
	if got.DataHash != data.DataHash {
		t.Errorf("data hash: want %s, got %s", data.DataHash, got.DataHash)
	}
	if got.Category != "meter" {
		t.Errorf("category: want meter, got %s", got.Category)
	}
}

func TestGetEnergyDataNotFound(t *testing.T) {
	k, ctx := setupKeeper(t)

	_, found := k.GetEnergyData(ctx, "nonexistent")
	if found {
		t.Fatal("expected not found for nonexistent ID")
	}
}

func TestGenerateID(t *testing.T) {
	k, ctx := setupKeeper(t)

	id1 := k.GenerateID(ctx)
	id2 := k.GenerateID(ctx)

	if id1 == id2 {
		t.Fatal("generated IDs should be unique")
	}
	if id1 != "energy-1" {
		t.Errorf("first ID: want energy-1, got %s", id1)
	}
	if id2 != "energy-2" {
		t.Errorf("second ID: want energy-2, got %s", id2)
	}
}

func TestGetEnergyDataByCategory(t *testing.T) {
	k, ctx := setupKeeper(t)

	k.SubmitEnergyData(ctx, types.EnergyData{
		ID: "e-1", Category: "meter", Submitter: "a", DataHash: "h1",
	})
	k.SubmitEnergyData(ctx, types.EnergyData{
		ID: "e-2", Category: "ev_charging", Submitter: "a", DataHash: "h2",
	})
	k.SubmitEnergyData(ctx, types.EnergyData{
		ID: "e-3", Category: "meter", Submitter: "b", DataHash: "h3",
	})

	meters := k.GetEnergyDataByCategory(ctx, "meter")
	if len(meters) != 2 {
		t.Errorf("expected 2 meter records, got %d", len(meters))
	}

	charging := k.GetEnergyDataByCategory(ctx, "ev_charging")
	if len(charging) != 1 {
		t.Errorf("expected 1 ev_charging record, got %d", len(charging))
	}

	empty := k.GetEnergyDataByCategory(ctx, "nonexistent_category")
	if len(empty) != 0 {
		t.Errorf("expected 0 records for unknown category, got %d", len(empty))
	}
}

func TestGetEnergyDataBySubmitter(t *testing.T) {
	k, ctx := setupKeeper(t)

	k.SubmitEnergyData(ctx, types.EnergyData{
		ID: "e-1", Category: "meter", Submitter: "alice", DataHash: "h1",
	})
	k.SubmitEnergyData(ctx, types.EnergyData{
		ID: "e-2", Category: "meter", Submitter: "bob", DataHash: "h2",
	})
	k.SubmitEnergyData(ctx, types.EnergyData{
		ID: "e-3", Category: "trade", Submitter: "alice", DataHash: "h3",
	})

	aliceData := k.GetEnergyDataBySubmitter(ctx, "alice")
	if len(aliceData) != 2 {
		t.Errorf("expected 2 records for alice, got %d", len(aliceData))
	}
}

func TestBatchSubmission(t *testing.T) {
	k, ctx := setupKeeper(t)

	batch := types.BatchSubmission{
		ID:         "batch-1",
		Submitter:  "alice",
		Category:   "meter",
		DataCount:  3,
		MerkleRoot: "0xroot",
		Timestamp:  1000,
	}
	k.SubmitBatch(ctx, batch)

	got, found := k.GetBatch(ctx, "batch-1")
	if !found {
		t.Fatal("expected to find batch")
	}
	if got.MerkleRoot != batch.MerkleRoot {
		t.Errorf("merkle root: want %s, got %s", batch.MerkleRoot, got.MerkleRoot)
	}
	if got.Category != "meter" {
		t.Errorf("category: want meter, got %s", got.Category)
	}
}

func TestParamsGetSet(t *testing.T) {
	k, ctx := setupKeeper(t)

	defaults := k.GetParams(ctx)
	if defaults.MaxBatchSize != 100 {
		t.Errorf("default max_batch_size: want 100, got %d", defaults.MaxBatchSize)
	}

	params := types.Params{
		MaxBatchSize:      50,
		AllowedSubmitters: []string{"alice"},
	}
	k.SetParams(ctx, params)

	got := k.GetParams(ctx)
	if got.MaxBatchSize != 50 {
		t.Errorf("max_batch_size: want 50, got %d", got.MaxBatchSize)
	}
	if !k.IsAllowedSubmitter(ctx, "alice") {
		t.Error("alice should be an allowed submitter")
	}
	if k.IsAllowedSubmitter(ctx, "bob") {
		t.Error("bob should not be an allowed submitter")
	}
}

func TestGenesisImportExport(t *testing.T) {
	k, ctx := setupKeeper(t)

	gs := types.GenesisState{
		Params: types.Params{MaxBatchSize: 200},
		DataRecords: []types.EnergyData{
			{ID: "e-1", Category: "meter", Submitter: "a", DataHash: "h1"},
		},
		Batches: []types.BatchSubmission{
			{ID: "b-1", Submitter: "a", Category: "meter", DataCount: 1, MerkleRoot: "r1", Timestamp: 100},
		},
	}

	k.InitGenesis(ctx, gs)

	exported := k.ExportGenesis(ctx)
	if exported.Params.MaxBatchSize != 200 {
		t.Errorf("exported max_batch_size: want 200, got %d", exported.Params.MaxBatchSize)
	}
	if len(exported.DataRecords) != 1 {
		t.Errorf("exported data records: want 1, got %d", len(exported.DataRecords))
	}
	if len(exported.Batches) != 1 {
		t.Errorf("exported batches: want 1, got %d", len(exported.Batches))
	}
}
