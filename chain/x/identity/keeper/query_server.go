package keeper

import (
	"context"
	"fmt"

	sdk "github.com/cosmos/cosmos-sdk/types"

	"energychain/x/identity/types"
)

type queryServer struct {
	keeper Keeper
}

func NewQueryServerImpl(keeper Keeper) types.QueryServer {
	return &queryServer{keeper: keeper}
}

var _ types.QueryServer = &queryServer{}

func (q *queryServer) QueryIdentity(goCtx context.Context, req *types.QueryIdentityRequest) (*types.QueryIdentityResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)
	identity, found := q.keeper.GetIdentity(ctx, req.Address)
	if !found {
		return nil, fmt.Errorf("identity not found: %s", req.Address)
	}
	return &types.QueryIdentityResponse{Identity: identity}, nil
}

func (q *queryServer) QueryIdentitiesByRole(goCtx context.Context, req *types.QueryIdentitiesByRoleRequest) (*types.QueryIdentitiesByRoleResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)
	identities := q.keeper.GetIdentitiesByRole(ctx, req.Role)
	return &types.QueryIdentitiesByRoleResponse{Identities: identities}, nil
}

func (q *queryServer) QueryAllIdentities(goCtx context.Context, _ *types.QueryAllIdentitiesRequest) (*types.QueryAllIdentitiesResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)
	identities := q.keeper.GetAllIdentities(ctx)
	return &types.QueryAllIdentitiesResponse{Identities: identities}, nil
}
