package keeper

import (
	"encoding/binary"
	"encoding/json"

	storetypes "cosmossdk.io/store/types"
	"github.com/cosmos/cosmos-sdk/codec"
	sdk "github.com/cosmos/cosmos-sdk/types"

	"energychain/x/oracle/types"
)

type Keeper struct {
	cdc       codec.Codec
	storeKey  storetypes.StoreKey
	authority string // governance module address that can add/remove oracles
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
// Price Data
// ---------------------------------------------------------------------------

func (k Keeper) SetPriceData(ctx sdk.Context, data types.PriceData) {
	store := ctx.KVStore(k.storeKey)
	bz, _ := json.Marshal(data)

	store.Set(types.GetPriceDataKey(data.DataType, data.Timestamp), bz)
	store.Set(types.GetLatestPriceKey(data.DataType), bz)
}

func (k Keeper) GetLatestPrice(ctx sdk.Context, dataType types.DataType) (types.PriceData, bool) {
	store := ctx.KVStore(k.storeKey)
	bz := store.Get(types.GetLatestPriceKey(dataType))
	if bz == nil {
		return types.PriceData{}, false
	}
	var data types.PriceData
	if err := json.Unmarshal(bz, &data); err != nil {
		return types.PriceData{}, false
	}
	return data, true
}

func (k Keeper) GetPriceHistory(ctx sdk.Context, dataType types.DataType, fromTime, toTime int64) []types.PriceData {
	store := ctx.KVStore(k.storeKey)
	prefix := types.GetPriceDataPrefixByType(dataType)

	startKey := types.GetPriceDataKey(dataType, fromTime)
	endKey := types.GetPriceDataKey(dataType, toTime+1)

	iter := store.Iterator(startKey, endKey)
	defer iter.Close()

	var results []types.PriceData
	for ; iter.Valid(); iter.Next() {
		key := iter.Key()
		if len(key) < len(prefix) {
			continue
		}
		var data types.PriceData
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

func (k Keeper) IsAuthorizedOracle(ctx sdk.Context, address string, dataType types.DataType) bool {
	oracle, found := k.GetOracle(ctx, address)
	if !found {
		return false
	}
	return oracle.IsAuthorizedFor(dataType)
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
	for _, price := range gs.Prices {
		k.SetPriceData(ctx, price)
	}
}

func (k Keeper) ExportGenesis(ctx sdk.Context) *types.GenesisState {
	store := ctx.KVStore(k.storeKey)

	var prices []types.PriceData
	priceIter := storetypes.KVStorePrefixIterator(store, types.PriceDataKeyPrefix)
	defer priceIter.Close()
	for ; priceIter.Valid(); priceIter.Next() {
		var p types.PriceData
		if err := json.Unmarshal(priceIter.Value(), &p); err != nil {
			continue
		}
		prices = append(prices, p)
	}

	return &types.GenesisState{
		Params:  k.GetParams(ctx),
		Oracles: k.GetAllOracles(ctx),
		Prices:  prices,
	}
}

// TimestampFromKey extracts the timestamp from a price data store key.
func TimestampFromKey(key []byte) int64 {
	if len(key) < 13 {
		return 0
	}
	return int64(binary.BigEndian.Uint64(key[5:13]))
}
