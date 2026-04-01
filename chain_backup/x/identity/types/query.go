package types

import "context"

// QueryServer defines the gRPC query server interface for the identity module.
type QueryServer interface {
	QueryIdentity(context.Context, *QueryIdentityRequest) (*QueryIdentityResponse, error)
	QueryIdentitiesByRole(context.Context, *QueryIdentitiesByRoleRequest) (*QueryIdentitiesByRoleResponse, error)
	QueryAllIdentities(context.Context, *QueryAllIdentitiesRequest) (*QueryAllIdentitiesResponse, error)
}

type QueryIdentityRequest struct {
	Address string `json:"address"`
}

type QueryIdentityResponse struct {
	Identity Identity `json:"identity"`
}

type QueryIdentitiesByRoleRequest struct {
	Role RoleType `json:"role"`
}

type QueryIdentitiesByRoleResponse struct {
	Identities []Identity `json:"identities"`
}

type QueryAllIdentitiesRequest struct{}

type QueryAllIdentitiesResponse struct {
	Identities []Identity `json:"identities"`
}
