namespace SchoolAdmission.Api.Models;

/// <summary>A student's application, which reserves one seat until it is confirmed or runs out.</summary>
public class Hold
{
    public Guid Id { get; set; }
    public Guid ClassId { get; set; }
    public required string StudentId { get; set; }
    public required string Status { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public DateTime? CancelledAt { get; set; }
}
