using Microsoft.Extensions.Options;
using SchoolAdmission.Api.Options;

namespace SchoolAdmission.Api.Services;

/// <summary>
/// Limits how many requests in this process can be changing applications at once. A request waiting for
/// a class's lock occupies a database connection, so without this limit an admission rush would take every
/// connection and page refreshes would queue behind it. This only shares connections fairly: seat safety
/// comes from the database lock, which also covers other backend processes.
/// </summary>
public sealed class HoldWriteGate(IOptions<HoldOptions> holdOptions)
{
    private readonly SemaphoreSlim slots = new(holdOptions.Value.MaxConcurrentWrites);

    public async Task<T> RunAsync<T>(Func<Task<T>> write, CancellationToken cancellationToken)
    {
        await slots.WaitAsync(cancellationToken);
        try
        {
            return await write();
        }
        finally
        {
            slots.Release();
        }
    }
}
