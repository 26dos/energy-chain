package keeper

import (
	"context"
	"fmt"

	sdk "github.com/cosmos/cosmos-sdk/types"

	"energychain/x/audit/types"
)

type queryServer struct {
	keeper Keeper
}

func NewQueryServerImpl(keeper Keeper) types.QueryServer {
	return &queryServer{keeper: keeper}
}

var _ types.QueryServer = &queryServer{}

func (q *queryServer) QueryAuditLog(goCtx context.Context, req *types.QueryAuditLogRequest) (*types.QueryAuditLogResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)
	log, found := q.keeper.GetAuditLog(ctx, req.ID)
	if !found {
		return nil, fmt.Errorf("audit log not found: %d", req.ID)
	}
	return &types.QueryAuditLogResponse{Log: log}, nil
}

func (q *queryServer) QueryAuditLogs(goCtx context.Context, req *types.QueryAuditLogsRequest) (*types.QueryAuditLogsResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)

	var logs []types.AuditLog
	if req.Actor != "" {
		logs = q.keeper.GetAuditLogsByActor(ctx, req.Actor)
	} else if req.EventType != "" {
		logs = q.keeper.GetAuditLogsByType(ctx, req.EventType)
	} else if req.FromTimestamp > 0 || req.ToTimestamp > 0 {
		from := req.FromTimestamp
		to := req.ToTimestamp
		if to == 0 {
			to = ctx.BlockTime().Unix()
		}
		logs = q.keeper.GetAuditLogsByTimeRange(ctx, from, to)
	} else {
		logs = q.keeper.GetAllLogs(ctx)
	}

	return &types.QueryAuditLogsResponse{Logs: logs}, nil
}
