using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Api.Contracts;
using SchoolAdmission.Api.Models;
using SchoolAdmission.Api.Services;
using SchoolAdmission.Api.Validation;

namespace SchoolAdmission.Api.Controllers;

[ApiController]
public class HoldsController(HoldService holds) : ControllerBase
{
    private const string StudentIdHeader = "X-Student-Id";

    [HttpPost("classes/{classId}/holds")]
    public async Task<ActionResult<HoldCreatedResponse>> Apply(
        string classId,
        [FromHeader(Name = StudentIdHeader), ValidStudentId] string? studentId,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(classId, out var id))
        {
            return ClassNotFound();
        }

        var result = await holds.ApplyAsync(id, studentId!, cancellationToken);

        return result.Outcome switch
        {
            ApplyOutcome.Created => Created(
                $"/holds/{result.HoldId}",
                new HoldCreatedResponse(result.HoldId, id, studentId!, HoldStatus.Held, result.ExpiresAt)),
            ApplyOutcome.ClassNotFound => ClassNotFound(),
            ApplyOutcome.AlreadyApplied => Conflict(new ApiError(
                ErrorCodes.AlreadyApplied,
                "This student already has an active application or a confirmed admission in this class.")),
            ApplyOutcome.NoSeatsAvailable => Conflict(new ApiError(
                ErrorCodes.NoSeatsAvailable,
                "There are no seats available in this class.")),
            _ => throw new UnreachableException(),
        };
    }

    [HttpGet("holds/{holdId}")]
    public async Task<ActionResult<HoldResponse>> Get(string holdId, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(holdId, out var id))
        {
            return HoldNotFound();
        }

        var hold = await holds.GetAsync(id, cancellationToken);
        if (hold is null)
        {
            return HoldNotFound();
        }

        return hold;
    }

    [HttpPost("holds/{holdId}/confirm")]
    public async Task<ActionResult<HoldConfirmedResponse>> Confirm(
        string holdId,
        [FromHeader(Name = StudentIdHeader), ValidStudentId] string? studentId,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(holdId, out var id))
        {
            return HoldNotFound();
        }

        var outcome = await holds.ConfirmAsync(id, studentId!, cancellationToken);
        if (outcome != HoldActionOutcome.Succeeded)
        {
            return Failure(outcome);
        }

        return new HoldConfirmedResponse(id, HoldStatus.Confirmed);
    }

    [HttpDelete("holds/{holdId}")]
    public async Task<IActionResult> Cancel(
        string holdId,
        [FromHeader(Name = StudentIdHeader), ValidStudentId] string? studentId,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(holdId, out var id))
        {
            return HoldNotFound();
        }

        var outcome = await holds.CancelAsync(id, studentId!, cancellationToken);
        if (outcome != HoldActionOutcome.Succeeded)
        {
            return Failure(outcome);
        }

        return NoContent();
    }

    [HttpGet("me/holds")]
    public Task<IReadOnlyList<HoldResponse>> Mine(
        [FromHeader(Name = StudentIdHeader), ValidStudentId] string? studentId,
        CancellationToken cancellationToken) =>
        holds.ListForStudentAsync(studentId!, cancellationToken);

    private ActionResult Failure(HoldActionOutcome outcome) => outcome switch
    {
        HoldActionOutcome.NotFound => HoldNotFound(),
        HoldActionOutcome.NotOwner => StatusCode(
            StatusCodes.Status403Forbidden,
            new ApiError(ErrorCodes.NotYourHold, "This application belongs to another student.")),
        HoldActionOutcome.Expired => Conflict(new ApiError(
            ErrorCodes.HoldExpired,
            "This application has expired.")),
        HoldActionOutcome.Cancelled => Conflict(new ApiError(
            ErrorCodes.HoldCancelled,
            "This application has been cancelled.")),
        HoldActionOutcome.Confirmed => Conflict(new ApiError(
            ErrorCodes.HoldConfirmed,
            "This admission is confirmed and can no longer be cancelled.")),
        _ => throw new UnreachableException(),
    };

    private NotFoundObjectResult ClassNotFound() =>
        NotFound(new ApiError(ErrorCodes.ClassNotFound, "No class exists with this ID."));

    private NotFoundObjectResult HoldNotFound() =>
        NotFound(new ApiError(ErrorCodes.HoldNotFound, "No application exists with this ID."));
}
