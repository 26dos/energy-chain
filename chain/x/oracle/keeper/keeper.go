package keeper

import (
	"encoding/json"

	storetypes "cosmossdk.io/store/types"
	"github.com/cosmos/cosmos-sdk/codec"
	sdk "github.com/cosmos/cosmos-sdk/types"

	"energychain/x/oracle/types"
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
// Oracle Data
// ---------------------------------------------------------------------------

func (k Keeper) SetOracleData(ctx sdk.Context, data types.OracleData) {
	store := ctx.KVStore(k.storeKey)
	bz, _ := json.Marshal(data)

	store.Set(types.GetOracleDataKey(data.Category, data.Timestamp), bz)
	store.Set(types.GetLatestDataKey(data.Category), bz)
}

func (k Keeper) GetLatestData(ctx sdk.Context, category string) (types.OracleData, bool) {
	store := ctx.KVStore(k.storeKey)
	bz := store.Get(types.GetLatestDataKey(category))
	if bz == nil {
		return types.OracleData{}, false
	}
	var data types.OracleData
	if err := json.Unmarshal(bz, &data); err != nil {
		return types.OracleData{}, false
	}
	return data, true
}

func (k Keeper) GetDataHistory(ctx sdk.Context, category string, fromTime, toTime int64) []types.OracleData {
	store := ctx.KVStore(k.storeKey)

	startKey := types.GetOracleDataKey(category, fromTime)
	endKey := types.GetOracleDataKey(category, toTime+1)

	iter := store.Iterator(startKey, endKey)
	defer iter.Close()

	var results []types.OracleData
	for ; iter.Valid(); iter.Next() {
		var data types.OracleData
		if err := json.Unmarshal(iter.Value(), &data); err != nil {
			continue
		}
		results = append(results, data)
	}
	return results
}

// ---------------------------------------------------------------------------
// Oracle Management
// ---------------------------------------------------------------------------

func (k Keeper) AddOracle(ctx sdk.Context, oracle types.OracleInfo) {
	store := ctx.KVStore(k.storeKey)
	bz, _ := json.Marshal(oracle)
	store.Set(types.GetOracleKey(oracle.Address), bz)
}

func (k Keeper) RemoveOracle(ctx sdk.Context, address string) {
	store := ctx.KVStore(k.storeKey)
	store.Delete(types.GetOracleKey(address))
}

func (k Keeper) GetOracle(ctx sdk.Context, address string) (types.OracleInfo, bool) {
	store := ctx.KVStore(k.storeKey)
	bz := store.Get(types.GetOracleKey(address))
	if bz == nil {
		return types.OracleInfo{}, false
	}
	var info types.OracleInfo
	if err := json.Unmarshal(bz, &info); err != nil {
		return types.OracleInfo{}, false
	}
	return info, true
}

func (k Keeper) IsAuthorizedOracle(ctx sdk.Context, address, category string) bool {
	oracle, found := k.GetOracle(ctx, address)
	if !found {
		return false
	}
	return oracle.IsAuthorizedFor(category)
}

func (k Keeper) GetAllOracles(ctx sdk.Context) []types.OracleInfo {
	store := ctx.KVStore(k.storeKey)
	iter := storetypes.KVStorePrefixIterator(store, types.OracleInfoKeyPrefix)
	defer iter.Close()

	var oracles []types.OracleInfo
	for ; iter.Valid(); iter.Next() {
		var info types.OracleInfo
		if err := json.Unmarshal(iter.Value(), &info); err != nil {
			continue
		}
		oracles = append(oracles, info)
	}
	return oracles
}

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

var paramsKey = []byte("oracle_params")

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

// ---------------------------------------------------------------------------
// Genesis helpers
// ---------------------------------------------------------------------------

func (k Keeper) InitGenesis(ctx sdk.Context, gs types.GenesisState) {
	k.SetParams(ctx, gs.Params)
	for _, oracle := range gs.Oracles {
		k.AddOracle(ctx, oracle)
	}
	for _, data := range gs.Data {
		k.SetOracleData(ctx, data)
	}
}

func (k Keeper) ExportGenesis(ctx sdk.Context) *types.GenesisState {
	store := ctx.KVStore(k.storeKey)

	var data []types.OracleData
	dataIter := storetypes.KVStorePrefixIterator(store, types.OracleDataKeyPrefix)
	defer dataIter.Close()
	for ; dataIter.Valid(); dataIter.Next() {
		var d types.OracleData
		if err := json.Unmarshal(dataIter.Value(), &d); err != nil {
			continue
		}
		data = append(data, d)
	}

	return &types.GenesisState{
		Params:  k.GetParams(ctx),
		Oracles: k.GetAllOracles(ctx),
		Data:    data,
	}
}
