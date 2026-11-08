using System.ComponentModel.DataAnnotations;

namespace SchoolAdmission.Api.Contracts;

public sealed class CreateClassRequest
{
    [Required(ErrorMessage = "name is required.")]
    [StringLength(200, ErrorMessage = "name must be 200 characters or fewer.")]
    public string? Name { get; init; }

    [Required(ErrorMessage = "totalSeats is required.")]
    [Range(1, int.MaxValue, ErrorMessage = "totalSeats must be a whole number of 1 or more.")]
    public int? TotalSeats { get; init; }
}

public sealed record ClassResponse(Guid Id, string Name, int TotalSeats);

public sealed record ClassSeatsResponse(
    Guid Id,
    string Name,
    int TotalSeats,
    int HeldSeats,
    int ConfirmedSeats,
    int AvailableSeats);
