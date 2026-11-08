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
    [HttpPost("classes/{classId}/holds")]
    public async Task<ActionResult<HoldCreatedResponse>> Apply(
        string classId,
        [FromHeader(Name = "X-Student-Id"), ValidStudentId] string? studentId,
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

    private NotFoundObjectResult ClassNotFound() =>
        NotFound(new ApiError(ErrorCodes.ClassNotFound, "No class exists with this ID."));
}
