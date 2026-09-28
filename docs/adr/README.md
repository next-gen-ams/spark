# Architecture decision records

ADRs capture decisions that affect EMT Tracker's security, data or operating model. They are immutable once accepted; later changes should supersede an earlier ADR rather than rewriting its history.

| ADR                                                  | Status     | Decision                                                                    |
| ---------------------------------------------------- | ---------- | --------------------------------------------------------------------------- |
| [0001](0001-dual-path-email-delivery.md)             | Superseded | Separate automatic Insights reminders from member-initiated delegated email |
| [0002](0002-automatic-reminders-only.md)             | Accepted   | Use automatic Insights reminders only                                       |
| [0003](0003-date-assigned-meeting-agendas.md)        | Accepted   | Assign agenda topics to explicit fortnightly meeting dates                  |
| [0004](0004-resilient-microsoft-session-recovery.md) | Accepted   | Use a blank callback and interactive fallback for Microsoft sessions        |

Use [template.md](template.md) for future decisions.
