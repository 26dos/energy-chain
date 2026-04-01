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

func NewQueryServerImpl(keeper Keeper) types.QueryServer {
	return &queryServer{Keeper: keeper}
}

var _ types.QueryServer = queryServer{}

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

func (q queryServer) QueryAuditLogs(goCtx context.Context, req *types.QueryAuditLogsRequest) (*types.QueryAuditLogsResponse, error) {
	if req == nil {
		return nil, sdkerrors.ErrInvalidRequest.Wrap("empty request")
	}

	ctx := sdk.UnwrapSDKContext(goCtx)

	var logs []types.AuditLog

	switch {
	case req.Actor != "":
		logs = q.GetAuditLogsByActor(ctx, req.Actor)
	case req.EventType != "":
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
