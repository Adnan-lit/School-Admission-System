namespace SchoolAdmission.Api.Options;

public sealed class HoldOptions
{
    public int DurationSeconds { get; set; } = 600;

    public TimeSpan CleanupInterval { get; set; } = TimeSpan.FromSeconds(5);

    public int MaxConcurrentApplications { get; set; } = 10;

    public int MaxConcurrentApplicationsPerClass { get; set; } = 3;
}
