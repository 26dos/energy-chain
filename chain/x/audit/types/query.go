package types

import "context"

type QueryServer interface {
	QueryAuditLog(context.Context, *QueryAuditLogRequest) (*QueryAuditLogResponse, error)
	QueryAuditLogs(context.Context, *QueryAuditLogsRequest) (*QueryAuditLogsResponse, error)
}

type QueryAuditLogRequest struct {
	ID uint64 `json:"id"`
}

type QueryAuditLogResponse struct {
	Log AuditLog `json:"log"`
}

type QueryAuditLogsRequest struct {
	Actor         string `json:"actor,omitempty"`
	EventType     string `json:"event_type,omitempty"` // user-defined event type string
	FromTimestamp int64  `json:"from_timestamp,omitempty"`
	ToTimestamp   int64  `json:"to_timestamp,omitempty"`
}

type QueryAuditLogsResponse struct {
	Logs []AuditLog `json:"logs"`
}
