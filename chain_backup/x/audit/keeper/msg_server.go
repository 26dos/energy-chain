package keeper

import (
	"context"
	"fmt"

	sdk "github.com/cosmos/cosmos-sdk/types"

	"energychain/x/audit/types"
)

type msgServer struct {
	Keeper
}

// NewMsgServerImpl returns an implementation of the audit MsgServer interface.
func NewMsgServerImpl(keeper Keeper) types.MsgServer {
	return &msgServer{Keeper: keeper}
}

var _ types.MsgServer = msgServer{}

// RecordAudit handles the MsgRecordAudit transaction – it creates an audit log
// entry with an auto-incremented ID and populates block metadata.
func (m msgServer) RecordAudit(goCtx context.Context, msg *types.MsgRecordAudit) (*types.MsgRecordAuditResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)

	id := m.GetNextID(ctx)

	txHash := ""
	if txBytes := ctx.TxBytes(); len(txBytes) > 0 {
		txHash = fmt.Sprintf("%X", sdk.Keccak256(txBytes))
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
		sdk.NewAttribute("event_type", msg.EventType.String()),
		sdk.NewAttribute("actor", msg.Creator),
		sdk.NewAttribute("action", msg.Action),
	))

	return &types.MsgRecordAuditResponse{}, nil
}
