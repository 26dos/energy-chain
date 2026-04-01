package types

import "context"

// QueryServer defines the gRPC query server interface for the audit module.
type QueryServer interface {
	QueryAuditLog(context.Context, *QueryAuditLogRequest) (*QueryAuditLogResponse, error)
	QueryAuditLogs(context.Context, *QueryAuditLogsRequest) (*QueryAuditLogsResponse, error)
}

// ---------------------------------------------------------------------------
// QueryAuditLog – single log by ID
// ---------------------------------------------------------------------------

type QueryAuditLogRequest struct {
	ID uint64 `json:"id"`
}

type QueryAuditLogResponse struct {
	Log AuditLog `json:"log"`
}

// ---------------------------------------------------------------------------
// QueryAuditLogs – filtered list
// ---------------------------------------------------------------------------

type QueryAuditLogsRequest struct {
	Actor         string         `json:"actor,omitempty"`
	EventType     AuditEventType `json:"event_type,omitempty"`
	FromTimestamp int64          `json:"from_timestamp,omitempty"`
	ToTimestamp   int64          `json:"to_timestamp,omitempty"`
	FilterByType  bool           `json:"filter_by_type,omitempty"`
}

type QueryAuditLogsResponse struct {
	Logs []AuditLog `json:"logs"`
}
