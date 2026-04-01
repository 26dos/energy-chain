package keeper

import (
	"encoding/binary"
	"encoding/json"

	"cosmossdk.io/store/prefix"
	storetypes "cosmossdk.io/store/types"
	"github.com/cosmos/cosmos-sdk/codec"
	sdk "github.com/cosmos/cosmos-sdk/types"

	"energychain/x/audit/types"
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
// Counter (auto-increment ID)
// ---------------------------------------------------------------------------

func (k Keeper) GetNextID(ctx sdk.Context) uint64 {
	store := ctx.KVStore(k.storeKey)
	bz := store.Get(types.AuditCounterKey)
	if bz == nil {
		return 1
	}
	return bytesToUint64(bz) + 1
}

func (k Keeper) IncrementCounter(ctx sdk.Context, id uint64) {
	store := ctx.KVStore(k.storeKey)
	store.Set(types.AuditCounterKey, uint64ToBytes(id))
}

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

func (k Keeper) SetParams(ctx sdk.Context, params types.Params) {
	store := ctx.KVStore(k.storeKey)
	bz, err := json.Marshal(params)
	if err != nil {
		panic(err)
	}
	store.Set(types.ParamsKey, bz)
}

func (k Keeper) GetParams(ctx sdk.Context) types.Params {
	store := ctx.KVStore(k.storeKey)
	bz := store.Get(types.ParamsKey)
	if bz == nil {
		return types.DefaultParams()
	}
	var params types.Params
	if err := json.Unmarshal(bz, &params); err != nil {
		panic(err)
	}
	return params
}

// ---------------------------------------------------------------------------
// Audit Log CRUD
// ---------------------------------------------------------------------------

func (k Keeper) RecordAuditLog(ctx sdk.Context, log types.AuditLog) {
	store := ctx.KVStore(k.storeKey)

	bz, err := json.Marshal(log)
	if err != nil {
		panic(err)
	}

	store.Set(types.GetAuditLogKey(log.ID), bz)
	store.Set(types.GetAuditByActorKey(log.Actor, log.ID), []byte{0x01})
	store.Set(types.GetAuditByTypeKey(log.EventType, log.ID), []byte{0x01})
	store.Set(types.GetAuditByTimeKey(log.Timestamp, log.ID), []byte{0x01})
}

func (k Keeper) GetAuditLog(ctx sdk.Context, id uint64) (types.AuditLog, bool) {
	store := ctx.KVStore(k.storeKey)
	bz := store.Get(types.GetAuditLogKey(id))
	if bz == nil {
		return types.AuditLog{}, false
	}

	var log types.AuditLog
	if err := json.Unmarshal(bz, &log); err != nil {
		panic(err)
	}
	return log, true
}

// ---------------------------------------------------------------------------
// Index-based queries
// ---------------------------------------------------------------------------

func (k Keeper) GetAuditLogsByActor(ctx sdk.Context, actor string) []types.AuditLog {
	store := ctx.KVStore(k.storeKey)
	prefixStore := prefix.NewStore(store, types.GetAuditByActorPrefixKey(actor))

	var logs []types.AuditLog
	iter := prefixStore.Iterator(nil, nil)
	defer iter.Close()

	for ; iter.Valid(); iter.Next() {
		id := bytesToUint64(iter.Key())
		log, found := k.GetAuditLog(ctx, id)
		if found {
			logs = append(logs, log)
		}
	}
	return logs
}

// GetAuditLogsByType returns all audit logs matching the specified event type string.
func (k Keeper) GetAuditLogsByType(ctx sdk.Context, eventType string) []types.AuditLog {
	store := ctx.KVStore(k.storeKey)
	prefixStore := prefix.NewStore(store, types.GetAuditByTypePrefixKey(eventType))

	var logs []types.AuditLog
	iter := prefixStore.Iterator(nil, nil)
	defer iter.Close()

	for ; iter.Valid(); iter.Next() {
		id := bytesToUint64(iter.Key())
		log, found := k.GetAuditLog(ctx, id)
		if found {
			logs = append(logs, log)
		}
	}
	return logs
}

func (k Keeper) GetAuditLogsByTimeRange(ctx sdk.Context, from, to int64) []types.AuditLog {
	store := ctx.KVStore(k.storeKey)

	startKey := types.GetAuditByTimePrefixKey(from)
	endKey := types.GetAuditByTimeRangeEndKey(to)

	iter := store.Iterator(startKey, endKey)
	defer iter.Close()

	prefixLen := len(types.AuditByTimeKey)
	var logs []types.AuditLog
	for ; iter.Valid(); iter.Next() {
		key := iter.Key()
		if len(key) < prefixLen+16 {
			continue
		}
		id := bytesToUint64(key[prefixLen+8:])
		log, found := k.GetAuditLog(ctx, id)
		if found {
			logs = append(logs, log)
		}
	}
	return logs
}

// ---------------------------------------------------------------------------
// Full iteration
// ---------------------------------------------------------------------------

func (k Keeper) GetAllLogs(ctx sdk.Context) []types.AuditLog {
	store := ctx.KVStore(k.storeKey)
	prefixStore := prefix.NewStore(store, types.AuditLogKey)

	var logs []types.AuditLog
	iter := prefixStore.Iterator(nil, nil)
	defer iter.Close()

	for ; iter.Valid(); iter.Next() {
		var log types.AuditLog
		if err := json.Unmarshal(iter.Value(), &log); err != nil {
			panic(err)
		}
		logs = append(logs, log)
	}
	return logs
}

// ---------------------------------------------------------------------------
// Genesis helpers
// ---------------------------------------------------------------------------

func (k Keeper) InitGenesis(ctx sdk.Context, gs types.GenesisState) {
	k.SetParams(ctx, gs.Params)

	for _, log := range gs.Logs {
		k.RecordAuditLog(ctx, log)
	}

	if gs.Counter > 0 {
		k.IncrementCounter(ctx, gs.Counter)
	}
}

func (k Keeper) ExportGenesis(ctx sdk.Context) *types.GenesisState {
	logs := k.GetAllLogs(ctx)

	store := ctx.KVStore(k.storeKey)
	var counter uint64
	bz := store.Get(types.AuditCounterKey)
	if bz != nil {
		counter = bytesToUint64(bz)
	}

	return &types.GenesisState{
		Logs:    logs,
		Counter: counter,
		Params:  k.GetParams(ctx),
	}
}

func uint64ToBytes(v uint64) []byte {
	bz := make([]byte, 8)
	binary.BigEndian.PutUint64(bz, v)
	return bz
}

func bytesToUint64(bz []byte) uint64 {
	return binary.BigEndian.Uint64(bz)
}
