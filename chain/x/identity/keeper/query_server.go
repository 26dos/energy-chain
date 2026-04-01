package keeper

import (
	"context"

	sdk "github.com/cosmos/cosmos-sdk/types"
	sdkerrors "github.com/cosmos/cosmos-sdk/types/errors"

	"energychain/x/identity/types"
)

type queryServer struct {
	Keeper
}

func NewQueryServerImpl(keeper Keeper) types.QueryServer {
	return &queryServer{Keeper: keeper}
}

var _ types.QueryServer = queryServer{}

func (q queryServer) QueryIdentity(goCtx context.Context, req *types.QueryIdentityRequest) (*types.QueryIdentityResponse, error) {
	if req == nil {
		return nil, sdkerrors.ErrInvalidRequest.Wrap("empty request")
	}

	ctx := sdk.UnwrapSDKContext(goCtx)

	identity, found := q.GetIdentity(ctx, req.Address)
	if !found {
		return nil, sdkerrors.ErrNotFound.Wrapf("identity not found: %s", req.Address)
	}

	return &types.QueryIdentityResponse{Identity: identity}, nil
}

func (q queryServer) QueryIdentitiesByRole(goCtx context.Context, req *types.QueryIdentitiesByRoleRequest) (*types.QueryIdentitiesByRoleResponse, error) {
	if req == nil {
		return nil, sdkerrors.ErrInvalidRequest.Wrap("empty request")
	}

	ctx := sdk.UnwrapSDKContext(goCtx)
	identities := q.GetIdentitiesByRole(ctx, req.Role)

	return &types.QueryIdentitiesByRoleResponse{Identities: identities}, nil
}

func (q queryServer) QueryAllIdentities(goCtx context.Context, req *types.QueryAllIdentitiesRequest) (*types.QueryAllIdentitiesResponse, error) {
	if req == nil {
		return nil, sdkerrors.ErrInvalidRequest.Wrap("empty request")
	}

	ctx := sdk.UnwrapSDKContext(goCtx)
	identities := q.GetAllIdentities(ctx)

	return &types.QueryAllIdentitiesResponse{Identities: identities}, nil
}
