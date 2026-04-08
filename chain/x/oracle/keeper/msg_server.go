package keeper

import (
	"context"
	"fmt"

	sdk "github.com/cosmos/cosmos-sdk/types"

	"energychain/x/oracle/types"
)

type msgServer struct {
	keeper Keeper
}

var _ types.MsgServer = &msgServer{}

func NewMsgServerImpl(keeper Keeper) *msgServer {
	return &msgServer{keeper: keeper}
}

func (m *msgServer) SubmitData(goCtx context.Context, msg *types.MsgSubmitData) (*types.MsgSubmitDataResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)

	if !m.keeper.IsAuthorizedOracle(ctx, msg.Submitter, msg.Category) {
		return nil, fmt.Errorf("address %s is not an authorized oracle for category %s",
			msg.Submitter, msg.Category)
	}

	blockTime := ctx.BlockTime().Unix()
	params := m.keeper.GetParams(ctx)
	maxDrift := params.DataMaxAge
	if maxDrift <= 0 {
		maxDrift = 3600
	}
	if msg.Timestamp > blockTime+maxDrift {
		return nil, fmt.Errorf("timestamp %d is too far in the future (block time %d, max drift %ds)",
			msg.Timestamp, blockTime, maxDrift)
	}
	if msg.Timestamp < blockTime-maxDrift {
		return nil, fmt.Errorf("timestamp %d is too far in the past (block time %d, max drift %ds)",
			msg.Timestamp, blockTime, maxDrift)
	}

	data := types.OracleData{
		Category:    msg.Category,
		Value:       msg.Value,
		Metadata:    msg.Metadata,
		Timestamp:   msg.Timestamp,
		Submitter:   msg.Submitter,
		BlockHeight: ctx.BlockHeight(),
	}

	m.keeper.SetOracleData(ctx, data)

	ctx.EventManager().EmitEvent(sdk.NewEvent(
		"oracle_data_submitted",
		sdk.NewAttribute("submitter", msg.Submitter),
		sdk.NewAttribute("category", msg.Category),
		sdk.NewAttribute("timestamp", fmt.Sprintf("%d", msg.Timestamp)),
	))

	return &types.MsgSubmitDataResponse{}, nil
}

func (m *msgServer) AddOracle(goCtx context.Context, msg *types.MsgAddOracle) (*types.MsgAddOracleResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)

	if msg.Authority != m.keeper.GetAuthority() {
		return nil, fmt.Errorf("unauthorized: expected %s, got %s", m.keeper.GetAuthority(), msg.Authority)
	}

	oracle := types.OracleInfo{
		Address:              msg.OracleAddress,
		Name:                 msg.Name,
		Active:               true,
		AuthorizedCategories: msg.AuthorizedCategories,
	}

	m.keeper.AddOracle(ctx, oracle)

	ctx.EventManager().EmitEvent(sdk.NewEvent(
		"oracle_added",
		sdk.NewAttribute("address", msg.OracleAddress),
		sdk.NewAttribute("name", msg.Name),
	))

	return &types.MsgAddOracleResponse{}, nil
}

func (m *msgServer) RemoveOracle(goCtx context.Context, msg *types.MsgRemoveOracle) (*types.MsgRemoveOracleResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)

	if msg.Authority != m.keeper.GetAuthority() {
		return nil, fmt.Errorf("unauthorized: expected %s, got %s", m.keeper.GetAuthority(), msg.Authority)
	}

	if _, found := m.keeper.GetOracle(ctx, msg.OracleAddress); !found {
		return nil, fmt.Errorf("oracle not found: %s", msg.OracleAddress)
	}

	m.keeper.RemoveOracle(ctx, msg.OracleAddress)

	ctx.EventManager().EmitEvent(sdk.NewEvent(
		"oracle_removed",
		sdk.NewAttribute("address", msg.OracleAddress),
	))

	return &types.MsgRemoveOracleResponse{}, nil
}
