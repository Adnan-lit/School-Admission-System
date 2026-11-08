using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Options;

namespace SchoolAdmission.Api.Services;

/// <summary>
/// Records EXPIRED on holds whose time has run out. Seats do not depend on this job: every seat count and
/// status check compares expires_at directly, so a seat is free the moment its hold lapses. The job only
/// keeps the stored status truthful and the index of active holds small.
/// </summary>
public sealed class ExpiredHoldCleanupService(
    IServiceScopeFactory scopeFactory,
    IOptions<HoldOptions> holdOptions,
    ILogger<ExpiredHoldCleanupService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(holdOptions.Value.CleanupInterval);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await MarkLapsedHoldsAsync(stoppingToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                // An unhandled exception here would stop the whole app, and the next tick can simply retry.
                logger.LogWarning(exception, "Could not mark lapsed holds as expired. Will try again.");
            }
        }
    }

    private async Task MarkLapsedHoldsAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // SKIP LOCKED means this never waits on a request in progress, or on the same job in another
        // backend process, so it can't cause a deadlock. Anything skipped is picked up on the next tick.
        await db.Database.ExecuteSqlAsync(
            $"""
            UPDATE holds SET status = 'EXPIRED'
            WHERE id IN (
                SELECT id FROM holds
                WHERE status = 'HELD' AND expires_at <= clock_timestamp()
                FOR UPDATE SKIP LOCKED
            )
            """,
            cancellationToken);
    }
}
