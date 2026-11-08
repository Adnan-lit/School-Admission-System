namespace SchoolAdmission.Api.Contracts;

public sealed record HoldCreatedResponse(
    Guid HoldId,
    Guid ClassId,
    string StudentId,
    string Status,
    DateTime ExpiresAt);

/// <summary>
/// Used by GET /holds/{holdId} and GET /me/holds. ServerTime is an addition to the contract:
/// it lets the UI count down correctly even if the user's computer clock is wrong.
/// </summary>
public sealed record HoldResponse(
    Guid HoldId,
    Guid ClassId,
    string ClassName,
    string Status,
    DateTime ExpiresAt,
    DateTime ServerTime);

public sealed record HoldConfirmedResponse(Guid HoldId, string Status);
