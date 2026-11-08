using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SchoolAdmission.Api.Data;
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

public class HoldService(AppDbContext db, IOptions<HoldOptions> holdOptions)
{
    public async Task<ApplyResult> ApplyAsync(Guid classId, string studentId, CancellationToken cancellationToken)
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
}
