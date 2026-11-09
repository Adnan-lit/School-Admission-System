using SchoolAdmission.Api.Options;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Tests;

public class HoldWriteGateTests
{
    private static HoldWriteGate GateWithSlots(int slots) =>
        new(Microsoft.Extensions.Options.Options.Create(new HoldOptions { MaxConcurrentWrites = slots }));

    [Fact]
    public async Task Never_runs_more_writes_at_once_than_it_has_slots()
    {
        var gate = GateWithSlots(3);
        var running = 0;
        var highestSeen = 0;

        await Task.WhenAll(Enumerable.Range(0, 50).Select(_ => gate.RunAsync(
            async () =>
            {
                var nowRunning = Interlocked.Increment(ref running);
                lock (gate)
                {
                    highestSeen = Math.Max(highestSeen, nowRunning);
                }

                await Task.Delay(5);
                Interlocked.Decrement(ref running);
                return true;
            },
            CancellationToken.None)));

        Assert.Equal(3, highestSeen);
    }

    [Fact]
    public async Task A_failed_write_gives_its_slot_back()
    {
        var gate = GateWithSlots(1);

        await Assert.ThrowsAsync<InvalidOperationException>(() => gate.RunAsync<bool>(
            () => throw new InvalidOperationException("write failed"),
            CancellationToken.None));

        Assert.True(await gate.RunAsync(() => Task.FromResult(true), CancellationToken.None));
    }

    [Fact]
    public async Task A_cancelled_wait_never_runs_the_write()
    {
        var gate = GateWithSlots(1);
        var holdSlot = new TaskCompletionSource<bool>();
        var firstWrite = gate.RunAsync(() => holdSlot.Task, CancellationToken.None);
        using var cancellation = new CancellationTokenSource();
        var ran = false;

        var secondWrite = gate.RunAsync(
            () =>
            {
                ran = true;
                return Task.FromResult(true);
            },
            cancellation.Token);
        await cancellation.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => secondWrite);
        Assert.False(ran);

        holdSlot.SetResult(true);
        await firstWrite;
    }
}
