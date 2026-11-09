using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SchoolAdmission.Api.Contracts;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Models;
using SchoolAdmission.Api.Options;

namespace SchoolAdmission.Api.Services;

public enum ApplyOutcome
{
    Created,
    ClassNotFound,
    AlreadyApplied,
    NoSeatsAvailable,
}

public sealed record ApplyResult(ApplyOutcome Outcome, Guid HoldId = default, DateTime ExpiresAt = default);

public enum HoldActionOutcome
{
    Succeeded,
    NotFound,
    NotOwner,
    Expired,
    Cancelled,
    Confirmed,
}

public class HoldService(AppDbContext db, IOptions<HoldOptions> holdOptions, HoldWriteGate writeGate)
{
    public Task<ApplyResult> ApplyAsync(Guid classId, string studentId, CancellationToken cancellationToken) =>
        writeGate.RunAsync(() => ApplyUnderGateAsync(classId, studentId, cancellationToken), cancellationToken);

    public Task<HoldActionOutcome> ConfirmAsync(Guid holdId, string studentId, CancellationToken cancellationToken) =>
        writeGate.RunAsync(() => ConfirmUnderGateAsync(holdId, studentId, cancellationToken), cancellationToken);

    public Task<HoldActionOutcome> CancelAsync(Guid holdId, string studentId, CancellationToken cancellationToken) =>
        writeGate.RunAsync(() => CancelUnderGateAsync(holdId, studentId, cancellationToken), cancellationToken);

    private async Task<ApplyResult> ApplyUnderGateAsync(Guid classId, string studentId, CancellationToken cancellationToken)
    {
        // Leaving this method without committing rolls back and releases the lock.
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        var totalSeats = await LockClassAsync(classId, cancellationToken);
        if (totalSeats is null)
        {
            return new ApplyResult(ApplyOutcome.ClassNotFound);
        }

        // This student's own lapsed hold may not be marked EXPIRED yet.
        // Marking it now stops it from counting as an active application.
        await db.Database.ExecuteSqlAsync(
            $"""
            UPDATE holds SET status = 'EXPIRED'
            WHERE class_id = {classId} AND student_id = {studentId}
              AND status = 'HELD' AND expires_at <= clock_timestamp()
            """,
            cancellationToken);

        var activeHolds = await db.Database
            .SqlQuery<int>(
                $"""
                SELECT count(*)::int AS "Value" FROM holds
                WHERE class_id = {classId} AND student_id = {studentId}
                  AND status IN ('HELD', 'CONFIRMED')
                """)
            .ToListAsync(cancellationToken);

        if (activeHolds[0] > 0)
        {
            return new ApplyResult(ApplyOutcome.AlreadyApplied);
        }

        var takenSeats = await db.Database
            .SqlQuery<int>(
                $"""
                SELECT count(*)::int AS "Value" FROM holds
                WHERE class_id = {classId}
                  AND (status = 'CONFIRMED' OR (status = 'HELD' AND expires_at > clock_timestamp()))
                """)
            .ToListAsync(cancellationToken);

        if (takenSeats[0] >= totalSeats)
        {
            return new ApplyResult(ApplyOutcome.NoSeatsAvailable);
        }

        var holdId = Guid.NewGuid();
        var durationSeconds = holdOptions.Value.DurationSeconds;

        // Expiry is stored in whole seconds, as in the contract's example.
        // It is rounded up so that a student never gets less than the full time.
        var expiresAt = await db.Database
            .SqlQuery<DateTime>(
                $"""
                INSERT INTO holds (id, class_id, student_id, status, expires_at)
                VALUES (
                    {holdId}, {classId}, {studentId}, 'HELD',
                    date_trunc('second', clock_timestamp() + make_interval(secs => {durationSeconds}) + interval '999999 microseconds')
                )
                RETURNING expires_at AS "Value"
                """)
            .ToListAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        return new ApplyResult(ApplyOutcome.Created, holdId, expiresAt[0]);
    }

    private async Task<HoldActionOutcome> ConfirmUnderGateAsync(Guid holdId, string studentId, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        var hold = await LockHoldAsync(holdId, cancellationToken);
        if (hold is null)
        {
            return HoldActionOutcome.NotFound;
        }

        if (hold.StudentId != studentId)
        {
            return HoldActionOutcome.NotOwner;
        }

        switch (hold.CurrentStatus)
        {
            case HoldStatus.Held:
                await db.Database.ExecuteSqlAsync(
                    $"UPDATE holds SET status = 'CONFIRMED', confirmed_at = clock_timestamp() WHERE id = {holdId}",
                    cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return HoldActionOutcome.Succeeded;

            // A repeated confirm is a retry of something that already worked, so nothing changes.
            case HoldStatus.Confirmed:
                return HoldActionOutcome.Succeeded;

            case HoldStatus.Cancelled:
                return HoldActionOutcome.Cancelled;

            default:
                return HoldActionOutcome.Expired;
        }
    }

    private async Task<HoldActionOutcome> CancelUnderGateAsync(Guid holdId, string studentId, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        var hold = await LockHoldAsync(holdId, cancellationToken);
        if (hold is null)
        {
            return HoldActionOutcome.NotFound;
        }

        if (hold.StudentId != studentId)
        {
            return HoldActionOutcome.NotOwner;
        }

        switch (hold.CurrentStatus)
        {
            case HoldStatus.Held:
                await db.Database.ExecuteSqlAsync(
                    $"UPDATE holds SET status = 'CANCELLED', cancelled_at = clock_timestamp() WHERE id = {holdId}",
                    cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return HoldActionOutcome.Succeeded;

            // A repeated cancel is a retry of something that already worked, so nothing changes.
            case HoldStatus.Cancelled:
                return HoldActionOutcome.Succeeded;

            case HoldStatus.Confirmed:
                return HoldActionOutcome.Confirmed;

            default:
                return HoldActionOutcome.Expired;
        }
    }

    public Task<HoldResponse?> GetAsync(Guid holdId, CancellationToken cancellationToken) =>
        QueryHolds(hold => hold.Id == holdId).SingleOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<HoldResponse>> ListForStudentAsync(
        string studentId,
        CancellationToken cancellationToken) =>
        await QueryHolds(hold => hold.StudentId == studentId).ToListAsync(cancellationToken);

    // A lapsed hold is reported as EXPIRED straight away, without waiting for it to be marked in the table.
    // EF translates DateTime.UtcNow to Postgres's now(), so every backend instance uses the database clock.
    private IQueryable<HoldResponse> QueryHolds(Expression<Func<Hold, bool>> filter) =>
        from hold in db.Holds.Where(filter)
        join schoolClass in db.Classes on hold.ClassId equals schoolClass.Id
        orderby hold.CreatedAt descending, hold.Id
        select new HoldResponse(
            hold.Id,
            hold.ClassId,
            schoolClass.Name,
            hold.Status == HoldStatus.Held && hold.ExpiresAt <= DateTime.UtcNow ? HoldStatus.Expired : hold.Status,
            hold.ExpiresAt,
            DateTime.UtcNow);

    /// <summary>
    /// Takes the per-class lock and returns the class's seat total, or null if the class doesn't exist.
    /// Every change to a class's holds passes through this lock, so requests for the same class run
    /// one at a time. The lock lives in the database, so it also holds across several backend processes.
    /// The checks that follow must be separate statements: in READ COMMITTED each statement sees the
    /// latest committed data when it starts, while a single combined statement would keep the view
    /// from before it waited for the lock and miss the holds committed in the meantime.
    /// </summary>
    private async Task<int?> LockClassAsync(Guid classId, CancellationToken cancellationToken)
    {
        var rows = await db.Database
            .SqlQuery<int>($"""SELECT total_seats AS "Value" FROM classes WHERE id = {classId} FOR UPDATE""")
            .ToListAsync(cancellationToken);

        return rows.Count == 0 ? null : rows[0];
    }

    /// <summary>
    /// Takes the lock of the hold's class, then reads the hold. Confirm and cancel need the same lock as
    /// applying: otherwise a confirm in the last instant could race a new applicant for the same seat.
    /// </summary>
    private async Task<LockedHold?> LockHoldAsync(Guid holdId, CancellationToken cancellationToken)
    {
        // A hold's class never changes, so it is safe to read this before taking the lock.
        var classIds = await db.Database
            .SqlQuery<Guid>($"""SELECT class_id AS "Value" FROM holds WHERE id = {holdId}""")
            .ToListAsync(cancellationToken);

        if (classIds.Count == 0)
        {
            return null;
        }

        await LockClassAsync(classIds[0], cancellationToken);

        var holds = await db.Database
            .SqlQuery<LockedHold>(
                $"""
                SELECT student_id AS "StudentId", status AS "Status", expires_at <= clock_timestamp() AS "HasLapsed"
                FROM holds WHERE id = {holdId}
                """)
            .ToListAsync(cancellationToken);

        return holds[0];
    }

    private sealed class LockedHold
    {
        public required string StudentId { get; init; }
        public required string Status { get; init; }
        public bool HasLapsed { get; init; }

        public string CurrentStatus => Status == HoldStatus.Held && HasLapsed ? HoldStatus.Expired : Status;
    }
}
