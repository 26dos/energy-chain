package types

import "context"

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
	Role string `json:"role"` // user-defined role string
}

type QueryIdentitiesByRoleResponse struct {
	Identities []Identity `json:"identities"`
}

type QueryAllIdentitiesRequest struct{}

type QueryAllIdentitiesResponse struct {
	Identities []Identity `json:"identities"`
}
