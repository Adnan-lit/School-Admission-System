namespace SchoolAdmission.Api.Options;

public sealed class HoldOptions
{
    public int DurationSeconds { get; set; } = 600;

    public TimeSpan CleanupInterval { get; set; } = TimeSpan.FromSeconds(5);
}
