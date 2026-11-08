using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Contracts;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Models;

namespace SchoolAdmission.Api.Controllers;

[ApiController]
[Route("classes")]
public class ClassesController(AppDbContext db) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<ClassResponse>> Create(
        CreateClassRequest request,
        CancellationToken cancellationToken)
    {
        var schoolClass = new SchoolClass
        {
            Id = Guid.NewGuid(),
            Name = request.Name!.Trim(),
            TotalSeats = request.TotalSeats!.Value,
        };

        db.Classes.Add(schoolClass);
        await db.SaveChangesAsync(cancellationToken);

        return Created(
            $"/classes/{schoolClass.Id}",
            new ClassResponse(schoolClass.Id, schoolClass.Name, schoolClass.TotalSeats));
    }

    [HttpGet]
    public async Task<IReadOnlyList<ClassSeatsResponse>> List(CancellationToken cancellationToken)
    {
        var rows = await SeatCounts()
            .OrderBy(row => row.CreatedAt)
            .ThenBy(row => row.Id)
            .ToListAsync(cancellationToken);

        return rows.ConvertAll(ToResponse);
    }

    [HttpGet("{classId}")]
    public async Task<ActionResult<ClassSeatsResponse>> Get(string classId, CancellationToken cancellationToken)
    {
        // Taken as a string so that a badly formed ID is simply "not found".
        if (!Guid.TryParse(classId, out var id))
        {
            return ClassNotFound();
        }

        var row = await SeatCounts().SingleOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (row is null)
        {
            return ClassNotFound();
        }

        return ToResponse(row);
    }

    // Counts come from the holds themselves, so they can never drift out of step with them.
    // EF translates DateTime.UtcNow to Postgres's now(), so every backend instance uses the database clock.
    private IQueryable<SeatCountRow> SeatCounts() =>
        db.Classes.Select(schoolClass => new SeatCountRow
        {
            Id = schoolClass.Id,
            Name = schoolClass.Name,
            TotalSeats = schoolClass.TotalSeats,
            CreatedAt = schoolClass.CreatedAt,
            HeldSeats = db.Holds.Count(hold =>
                hold.ClassId == schoolClass.Id
                && hold.Status == HoldStatus.Held
                && hold.ExpiresAt > DateTime.UtcNow),
            ConfirmedSeats = db.Holds.Count(hold =>
                hold.ClassId == schoolClass.Id
                && hold.Status == HoldStatus.Confirmed),
        });

    private static ClassSeatsResponse ToResponse(SeatCountRow row) => new(
        row.Id,
        row.Name,
        row.TotalSeats,
        row.HeldSeats,
        row.ConfirmedSeats,
        row.TotalSeats - row.HeldSeats - row.ConfirmedSeats);

    private NotFoundObjectResult ClassNotFound() =>
        NotFound(new ApiError(ErrorCodes.ClassNotFound, "No class exists with this ID."));

    private sealed class SeatCountRow
    {
        public Guid Id { get; init; }
        public required string Name { get; init; }
        public int TotalSeats { get; init; }
        public DateTime CreatedAt { get; init; }
        public int HeldSeats { get; init; }
        public int ConfirmedSeats { get; init; }
    }
}
