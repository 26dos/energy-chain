package keeper

import (
	"context"
	"crypto/sha256"
	"fmt"

	sdk "github.com/cosmos/cosmos-sdk/types"

	"energychain/x/audit/types"
)

type msgServer struct {
	Keeper
}

func NewMsgServerImpl(keeper Keeper) types.MsgServer {
	return &msgServer{Keeper: keeper}
}

var _ types.MsgServer = msgServer{}

func (m msgServer) RecordAudit(goCtx context.Context, msg *types.MsgRecordAudit) (*types.MsgRecordAuditResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)

	id := m.GetNextID(ctx)

	txHash := ""
	if txBytes := ctx.TxBytes(); len(txBytes) > 0 {
		h := sha256.Sum256(txBytes)
		txHash = fmt.Sprintf("%X", h[:])
	}

	log := types.AuditLog{
		ID:          id,
		EventType:   msg.EventType,
		Actor:       msg.Creator,
		Target:      msg.Target,
		Action:      msg.Action,
		Data:        msg.Data,
		BlockHeight: ctx.BlockHeight(),
		Timestamp:   ctx.BlockTime().Unix(),
		TxHash:      txHash,
	}

	m.RecordAuditLog(ctx, log)
	m.IncrementCounter(ctx, id)

	ctx.EventManager().EmitEvent(sdk.NewEvent(
		"audit_recorded",
		sdk.NewAttribute("id", fmt.Sprintf("%d", id)),
		sdk.NewAttribute("event_type", msg.EventType),
		sdk.NewAttribute("actor", msg.Creator),
		sdk.NewAttribute("action", msg.Action),
	))

	return &types.MsgRecordAuditResponse{}, nil
}
