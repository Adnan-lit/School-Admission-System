namespace SchoolAdmission.Api.Models;

/// <summary>Status values, exactly as the API returns them and the database stores them.</summary>
public static class HoldStatus
{
    public const string Held = "HELD";
    public const string Confirmed = "CONFIRMED";
    public const string Expired = "EXPIRED";
    public const string Cancelled = "CANCELLED";
}
