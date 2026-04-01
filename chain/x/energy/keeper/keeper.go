package keeper

import (
	"encoding/binary"
	"encoding/json"
	"fmt"

	storetypes "cosmossdk.io/store/types"
	"github.com/cosmos/cosmos-sdk/codec"
	sdk "github.com/cosmos/cosmos-sdk/types"

	"energychain/x/energy/types"
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
// ID generation
// ---------------------------------------------------------------------------

func (k Keeper) GenerateID(ctx sdk.Context) string {
	store := ctx.KVStore(k.storeKey)
	var seq uint64
	bz := store.Get(types.DataCounterKey)
	if bz != nil {
		seq = binary.BigEndian.Uint64(bz)
	}
	seq++
	out := make([]byte, 8)
	binary.BigEndian.PutUint64(out, seq)
	store.Set(types.DataCounterKey, out)
	return fmt.Sprintf("energy-%d", seq)
}

// ---------------------------------------------------------------------------
// EnergyData CRUD
// ---------------------------------------------------------------------------

func (k Keeper) SubmitEnergyData(ctx sdk.Context, data types.EnergyData) {
	store := ctx.KVStore(k.storeKey)
	bz, _ := json.Marshal(data)

	store.Set(types.GetEnergyDataKey(data.ID), bz)
	store.Set(types.GetEnergyByCategoryKey(data.Category, data.ID), []byte(data.ID))
	store.Set(types.GetEnergyBySubmitterKey(data.Submitter, data.ID), []byte(data.ID))
}

func (k Keeper) GetEnergyData(ctx sdk.Context, id string) (types.EnergyData, bool) {
	store := ctx.KVStore(k.storeKey)
	bz := store.Get(types.GetEnergyDataKey(id))
	if bz == nil {
		return types.EnergyData{}, false
	}
	var data types.EnergyData
	if err := json.Unmarshal(bz, &data); err != nil {
		return types.EnergyData{}, false
	}
	return data, true
}

// GetEnergyDataByCategory returns all records matching the user-defined category string.
func (k Keeper) GetEnergyDataByCategory(ctx sdk.Context, category string) []types.EnergyData {
	store := ctx.KVStore(k.storeKey)
	prefix := types.GetEnergyByCategoryPrefixKey(category)
	iter := storetypes.KVStorePrefixIterator(store, prefix)
	defer iter.Close()

	var results []types.EnergyData
	for ; iter.Valid(); iter.Next() {
		id := string(iter.Value())
		if data, found := k.GetEnergyData(ctx, id); found {
			results = append(results, data)
		}
	}
	return results
}

func (k Keeper) GetEnergyDataBySubmitter(ctx sdk.Context, submitter string) []types.EnergyData {
	store := ctx.KVStore(k.storeKey)
	prefix := types.GetEnergyBySubmitterPrefixKey(submitter)
	iter := storetypes.KVStorePrefixIterator(store, prefix)
	defer iter.Close()

	var results []types.EnergyData
	for ; iter.Valid(); iter.Next() {
		id := string(iter.Value())
		if data, found := k.GetEnergyData(ctx, id); found {
			results = append(results, data)
		}
	}
	return results
}

func (k Keeper) GetAllData(ctx sdk.Context) []types.EnergyData {
	store := ctx.KVStore(k.storeKey)
	iter := storetypes.KVStorePrefixIterator(store, types.EnergyDataKeyPrefix)
	defer iter.Close()

	var results []types.EnergyData
	for ; iter.Valid(); iter.Next() {
		var data types.EnergyData
		if err := json.Unmarshal(iter.Value(), &data); err != nil {
			continue
		}
		results = append(results, data)
	}
	return results
}

// ---------------------------------------------------------------------------
// Batch CRUD
// ---------------------------------------------------------------------------

func (k Keeper) SubmitBatch(ctx sdk.Context, batch types.BatchSubmission) {
	store := ctx.KVStore(k.storeKey)
	bz, _ := json.Marshal(batch)
	store.Set(types.GetBatchSubmissionKey(batch.ID), bz)
}

func (k Keeper) GetBatch(ctx sdk.Context, id string) (types.BatchSubmission, bool) {
	store := ctx.KVStore(k.storeKey)
	bz := store.Get(types.GetBatchSubmissionKey(id))
	if bz == nil {
		return types.BatchSubmission{}, false
	}
	var batch types.BatchSubmission
	if err := json.Unmarshal(bz, &batch); err != nil {
		return types.BatchSubmission{}, false
	}
	return batch, true
}

func (k Keeper) GetAllBatches(ctx sdk.Context) []types.BatchSubmission {
	store := ctx.KVStore(k.storeKey)
	iter := storetypes.KVStorePrefixIterator(store, types.BatchSubmissionKeyPrefix)
	defer iter.Close()

	var results []types.BatchSubmission
	for ; iter.Valid(); iter.Next() {
		var batch types.BatchSubmission
		if err := json.Unmarshal(iter.Value(), &batch); err != nil {
			continue
		}
		results = append(results, batch)
	}
	return results
}

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

var paramsKey = []byte("energy_params")

func (k Keeper) SetParams(ctx sdk.Context, params types.Params) {
	store := ctx.KVStore(k.storeKey)
	bz, _ := json.Marshal(params)
	store.Set(paramsKey, bz)
}

func (k Keeper) GetParams(ctx sdk.Context) types.Params {
	store := ctx.KVStore(k.storeKey)
	bz := store.Get(paramsKey)
	if bz == nil {
		return types.DefaultParams()
	}
	var params types.Params
	if err := json.Unmarshal(bz, &params); err != nil {
		return types.DefaultParams()
	}
	return params
}

func (k Keeper) IsAllowedSubmitter(ctx sdk.Context, address string) bool {
	params := k.GetParams(ctx)
	if len(params.AllowedSubmitters) == 0 {
		return true
	}
	for _, allowed := range params.AllowedSubmitters {
		if allowed == address {
			return true
		}
	}
	return false
}

// ---------------------------------------------------------------------------
// Genesis helpers
// ---------------------------------------------------------------------------

func (k Keeper) InitGenesis(ctx sdk.Context, gs types.GenesisState) {
	k.SetParams(ctx, gs.Params)
	for _, data := range gs.DataRecords {
		k.SubmitEnergyData(ctx, data)
	}
	for _, batch := range gs.Batches {
		k.SubmitBatch(ctx, batch)
	}
}

func (k Keeper) ExportGenesis(ctx sdk.Context) *types.GenesisState {
	return &types.GenesisState{
		Params:      k.GetParams(ctx),
		DataRecords: k.GetAllData(ctx),
		Batches:     k.GetAllBatches(ctx),
	}
}
