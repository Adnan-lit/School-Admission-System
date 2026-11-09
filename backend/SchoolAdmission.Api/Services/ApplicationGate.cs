using Microsoft.Extensions.Options;
using SchoolAdmission.Api.Options;

namespace SchoolAdmission.Api.Services;

/// <summary>
/// Limits how many applications this process runs at once, per class and overall. An application waiting
/// for a class's lock occupies a database connection, so without limits a rush would take every connection.
/// Applications for one class run one at a time anyway, so a few are enough to keep that queue moving.
/// Only applying passes through here, so a rush can't delay payments, cancellations or page refreshes.
/// This only shares connections fairly: seat safety comes from the database lock.
/// </summary>
public sealed class ApplicationGate
{
    // A fixed number of queues, so requests for made-up class IDs can't make this grow.
    private const int ClassQueues = 64;

    private readonly SemaphoreSlim overallSlots;
    private readonly SemaphoreSlim[] classSlots;

    public ApplicationGate(IOptions<HoldOptions> holdOptions)
    {
        var options = holdOptions.Value;
        overallSlots = new SemaphoreSlim(options.MaxConcurrentApplications);
        classSlots = Enumerable.Range(0, ClassQueues)
            .Select(_ => new SemaphoreSlim(options.MaxConcurrentApplicationsPerClass))
            .ToArray();
    }

    public static int QueueFor(Guid classId) => (int)((uint)classId.GetHashCode() % ClassQueues);

    public async Task<T> RunAsync<T>(Guid classId, Func<Task<T>> apply, CancellationToken cancellationToken)
    {
        // The class's own queue comes first, so a rushed class can't fill the overall slots.
        var slots = classSlots[QueueFor(classId)];
        await slots.WaitAsync(cancellationToken);
        try
        {
            await overallSlots.WaitAsync(cancellationToken);
            try
            {
                return await apply();
            }
            finally
            {
                overallSlots.Release();
            }
        }
        finally
        {
            slots.Release();
        }
    }
}
