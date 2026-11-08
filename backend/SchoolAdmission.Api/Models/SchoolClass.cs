namespace SchoolAdmission.Api.Models;

/// <summary>An admission group such as "Class 6 - Morning Shift". Each shift is its own class.</summary>
public class SchoolClass
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public int TotalSeats { get; set; }
    public DateTime CreatedAt { get; set; }
}
