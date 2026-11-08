namespace SchoolAdmission.Api.Contracts;

public sealed record HoldCreatedResponse(
    Guid HoldId,
    Guid ClassId,
    string StudentId,
    string Status,
    DateTime ExpiresAt);
