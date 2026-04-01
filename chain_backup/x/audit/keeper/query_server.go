package keeper

import (
	"context"

	sdk "github.com/cosmos/cosmos-sdk/types"
	sdkerrors "github.com/cosmos/cosmos-sdk/types/errors"

	"energychain/x/audit/types"
)

type queryServer struct {
	Keeper
}

// NewQueryServerImpl returns an implementation of the audit QueryServer interface.
func NewQueryServerImpl(keeper Keeper) types.QueryServer {
	return &queryServer{Keeper: keeper}
}

var _ types.QueryServer = queryServer{}

// QueryAuditLog returns a single audit log by ID.
func (q queryServer) QueryAuditLog(goCtx context.Context, req *types.QueryAuditLogRequest) (*types.QueryAuditLogResponse, error) {
	if req == nil {
		return nil, sdkerrors.ErrInvalidRequest.Wrap("empty request")
	}

	ctx := sdk.UnwrapSDKContext(goCtx)

	log, found := q.GetAuditLog(ctx, req.ID)
	if !found {
		return nil, sdkerrors.ErrNotFound.Wrapf("audit log not found: %d", req.ID)
	}

	return &types.QueryAuditLogResponse{Log: log}, nil
}

// QueryAuditLogs returns audit logs matching the provided filters (actor,
// event type, and/or time range). When multiple filters are set, actor takes
// priority; time-range is used as fallback; otherwise all logs are returned.
func (q queryServer) QueryAuditLogs(goCtx context.Context, req *types.QueryAuditLogsRequest) (*types.QueryAuditLogsResponse, error) {
	if req == nil {
		return nil, sdkerrors.ErrInvalidRequest.Wrap("empty request")
	}

	ctx := sdk.UnwrapSDKContext(goCtx)

	var logs []types.AuditLog

	switch {
	case req.Actor != "":
		logs = q.GetAuditLogsByActor(ctx, req.Actor)
	case req.FilterByType:
		logs = q.GetAuditLogsByType(ctx, req.EventType)
	case req.FromTimestamp > 0 || req.ToTimestamp > 0:
		from := req.FromTimestamp
		to := req.ToTimestamp
		if to == 0 {
			to = ctx.BlockTime().Unix()
		}
		logs = q.GetAuditLogsByTimeRange(ctx, from, to)
	default:
		logs = q.GetAllLogs(ctx)
	}

	return &types.QueryAuditLogsResponse{Logs: logs}, nil
}
