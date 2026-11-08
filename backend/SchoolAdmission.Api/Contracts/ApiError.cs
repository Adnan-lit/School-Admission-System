namespace SchoolAdmission.Api.Contracts;

/// <summary>The body of every error response. The UI picks what to show the user from Code.</summary>
public sealed record ApiError(string Code, string Message);

public static class ErrorCodes
{
    public const string InvalidRequest = "INVALID_REQUEST";
    public const string ClassNotFound = "CLASS_NOT_FOUND";
    public const string AlreadyApplied = "ALREADY_APPLIED";
    public const string NoSeatsAvailable = "NO_SEATS_AVAILABLE";
    public const string InternalError = "INTERNAL_ERROR";
}
