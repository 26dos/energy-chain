package keeper

import (
	"context"
	"fmt"

	sdk "github.com/cosmos/cosmos-sdk/types"

	"energychain/x/energy/types"
)

type msgServer struct {
	keeper Keeper
}

func NewMsgServerImpl(keeper Keeper) *msgServer {
	return &msgServer{keeper: keeper}
}

func (m *msgServer) SubmitEnergyData(goCtx context.Context, msg *types.MsgSubmitEnergyData) error {
	ctx := sdk.UnwrapSDKContext(goCtx)

	if !m.keeper.IsAllowedSubmitter(ctx, msg.Submitter) {
		return fmt.Errorf("address %s is not an allowed submitter", msg.Submitter)
	}

	id := m.keeper.GenerateID(ctx)
	data := types.EnergyData{
		ID:          id,
		Category:    msg.Category,
		Submitter:   msg.Submitter,
		DataHash:    msg.DataHash,
		Metadata:    msg.Metadata,
		BlockHeight: ctx.BlockHeight(),
		Timestamp:   ctx.BlockTime().Unix(),
	}

	m.keeper.SubmitEnergyData(ctx, data)

	ctx.EventManager().EmitEvent(sdk.NewEvent(
		"energy_data_submitted",
		sdk.NewAttribute("id", id),
		sdk.NewAttribute("submitter", msg.Submitter),
		sdk.NewAttribute("category", msg.Category),
		sdk.NewAttribute("data_hash", msg.DataHash),
	))

	return nil
}

func (m *msgServer) BatchSubmit(goCtx context.Context, msg *types.MsgBatchSubmit) error {
	ctx := sdk.UnwrapSDKContext(goCtx)

	if !m.keeper.IsAllowedSubmitter(ctx, msg.Submitter) {
		return fmt.Errorf("address %s is not an allowed submitter", msg.Submitter)
	}

	params := m.keeper.GetParams(ctx)
	if uint32(len(msg.Items)) > params.MaxBatchSize {
		return fmt.Errorf("batch size %d exceeds maximum %d", len(msg.Items), params.MaxBatchSize)
	}

	batchID := m.keeper.GenerateID(ctx)
	now := ctx.BlockTime().Unix()
	height := ctx.BlockHeight()

	for _, item := range msg.Items {
		id := m.keeper.GenerateID(ctx)
		data := types.EnergyData{
			ID:          id,
			Category:    msg.Category,
			Submitter:   msg.Submitter,
			DataHash:    item.DataHash,
			Metadata:    item.Metadata,
			BlockHeight: height,
			Timestamp:   now,
		}
		m.keeper.SubmitEnergyData(ctx, data)
	}

	batch := types.BatchSubmission{
		ID:         batchID,
		Submitter:  msg.Submitter,
		Category:   msg.Category,
		DataCount:  uint32(len(msg.Items)),
		MerkleRoot: msg.MerkleRoot,
		Timestamp:  now,
	}
	m.keeper.SubmitBatch(ctx, batch)

	ctx.EventManager().EmitEvent(sdk.NewEvent(
		"energy_batch_submitted",
		sdk.NewAttribute("batch_id", batchID),
		sdk.NewAttribute("submitter", msg.Submitter),
		sdk.NewAttribute("category", msg.Category),
		sdk.NewAttribute("data_count", fmt.Sprintf("%d", len(msg.Items))),
		sdk.NewAttribute("merkle_root", msg.MerkleRoot),
	))

	return nil
}
