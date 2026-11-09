using SchoolAdmission.Api.Options;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Tests;

public class ApplicationGateTests
{
    private static ApplicationGate GateWith(int perClass, int overall) =>
        new(Microsoft.Extensions.Options.Options.Create(new HoldOptions
        {
            MaxConcurrentApplicationsPerClass = perClass,
            MaxConcurrentApplications = overall,
        }));

    private static async Task<int> HighestConcurrencyAsync(ApplicationGate gate, Func<int, Guid> classFor)
    {
        var running = 0;
        var highestSeen = 0;
        var sync = new object();

        await Task.WhenAll(Enumerable.Range(0, 60).Select(number => gate.RunAsync(
            classFor(number),
            async () =>
            {
                var nowRunning = Interlocked.Increment(ref running);
                lock (sync)
                {
                    highestSeen = Math.Max(highestSeen, nowRunning);
                }

                await Task.Delay(5);
                Interlocked.Decrement(ref running);
                return true;
            },
            CancellationToken.None)));

        return highestSeen;
    }

    private static (Guid First, Guid Second) TwoClassesInDifferentQueues()
    {
        var first = Guid.NewGuid();
        for (var attempt = 0; attempt < 20; attempt++)
        {
            var second = Guid.NewGuid();
            if (ApplicationGate.QueueFor(second) != ApplicationGate.QueueFor(first))
            {
                return (first, second);
            }
        }

        throw new InvalidOperationException("Every class landed in the same application queue.");
    }

    [Fact]
    public async Task One_class_never_runs_more_applications_than_its_limit()
    {
        var classId = Guid.NewGuid();

        var highest = await HighestConcurrencyAsync(GateWith(perClass: 2, overall: 100), _ => classId);

        Assert.Equal(2, highest);
    }

    [Fact]
    public async Task All_classes_together_never_run_more_than_the_overall_limit()
    {
        var highest = await HighestConcurrencyAsync(GateWith(perClass: 100, overall: 3), _ => Guid.NewGuid());

        Assert.Equal(3, highest);
    }

    [Fact]
    public async Task A_busy_class_does_not_hold_up_another_class()
    {
        var gate = GateWith(perClass: 1, overall: 100);
        var (busyClass, otherClass) = TwoClassesInDifferentQueues();
        var release = new TaskCompletionSource<bool>();
        var busy = gate.RunAsync(busyClass, () => release.Task, CancellationToken.None);

        var other = await gate
            .RunAsync(otherClass, () => Task.FromResult(true), CancellationToken.None)
            .WaitAsync(TimeSpan.FromSeconds(5));

        Assert.True(other);
        release.SetResult(true);
        await busy;
    }

    [Fact]
    public async Task A_failed_application_gives_its_slots_back()
    {
        var gate = GateWith(perClass: 1, overall: 1);
        var classId = Guid.NewGuid();

        await Assert.ThrowsAsync<InvalidOperationException>(() => gate.RunAsync<bool>(
            classId,
            () => throw new InvalidOperationException("application failed"),
            CancellationToken.None));

        Assert.True(await gate.RunAsync(classId, () => Task.FromResult(true), CancellationToken.None));
    }

    [Fact]
    public async Task A_cancelled_wait_never_runs_the_application()
    {
        var gate = GateWith(perClass: 1, overall: 1);
        var classId = Guid.NewGuid();
        var release = new TaskCompletionSource<bool>();
        var first = gate.RunAsync(classId, () => release.Task, CancellationToken.None);
        using var cancellation = new CancellationTokenSource();
        var ran = false;

        var second = gate.RunAsync(
            classId,
            () =>
            {
                ran = true;
                return Task.FromResult(true);
            },
            cancellation.Token);
        await cancellation.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => second);
        Assert.False(ran);

        release.SetResult(true);
        await first;
    }
}
