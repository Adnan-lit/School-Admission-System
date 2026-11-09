using System.Net;
using Microsoft.Extensions.DependencyInjection;
using SchoolAdmission.Api.Options;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Tests;

/// <summary>
/// Fills a class's application queue completely, then checks what still gets through.
/// These prove that a rush of applicants can't delay payments, cancellations or other classes.
/// </summary>
[Collection(nameof(ApiCollection))]
public class ApplicationQueueTests(ApiFixture fixture)
{
    private static readonly string Owner = AdmissionClient.StudentId(1);
    private static readonly string OtherStudent = AdmissionClient.StudentId(2);
    private static readonly TimeSpan MustFinishWithin = TimeSpan.FromSeconds(10);

    private readonly AdmissionClient api = new(fixture.CreateClient());

    private sealed class FullQueue(Task[] blockers, TaskCompletionSource<bool> release) : IAsyncDisposable
    {
        public async ValueTask DisposeAsync()
        {
            release.TrySetResult(true);
            await Task.WhenAll(blockers);
        }
    }

    private async Task<string> CreateClassInADifferentQueueThanAsync(string busyClass)
    {
        for (var attempt = 0; attempt < 20; attempt++)
        {
            var classId = await api.CreateClassAsync(totalSeats: 5);
            if (ApplicationGate.QueueFor(Guid.Parse(classId)) != ApplicationGate.QueueFor(Guid.Parse(busyClass)))
            {
                return classId;
            }
        }

        throw new InvalidOperationException("Every class landed in the same application queue.");
    }

    private FullQueue FillApplicationQueue(string classId)
    {
        var gate = fixture.Services.GetRequiredService<ApplicationGate>();
        var release = new TaskCompletionSource<bool>();
        var blockers = Enumerable.Range(0, new HoldOptions().MaxConcurrentApplicationsPerClass)
            .Select(_ => (Task)gate.RunAsync(Guid.Parse(classId), () => release.Task, CancellationToken.None))
            .ToArray();

        return new FullQueue(blockers, release);
    }

    [Fact]
    public async Task Paying_does_not_wait_behind_queued_applications()
    {
        var classId = await api.CreateClassAsync(totalSeats: 5);
        var holdId = await api.ApplyForHoldIdAsync(classId, Owner);
        await using var fullQueue = FillApplicationQueue(classId);

        var queuedApplication = api.ApplyAsync(classId, OtherStudent);
        var payment = await api.ConfirmAsync(holdId, Owner).WaitAsync(MustFinishWithin);

        Assert.Equal(HttpStatusCode.OK, payment.StatusCode);
        Assert.False(queuedApplication.IsCompleted);

        await fullQueue.DisposeAsync();
        Assert.Equal(HttpStatusCode.Created, (await queuedApplication).StatusCode);
    }

    [Fact]
    public async Task Cancelling_does_not_wait_behind_queued_applications()
    {
        var classId = await api.CreateClassAsync(totalSeats: 5);
        var holdId = await api.ApplyForHoldIdAsync(classId, Owner);
        await using var fullQueue = FillApplicationQueue(classId);

        var cancellation = await api.CancelAsync(holdId, Owner).WaitAsync(MustFinishWithin);

        Assert.Equal(HttpStatusCode.NoContent, cancellation.StatusCode);
    }

    [Fact]
    public async Task Applying_to_another_class_does_not_wait_behind_a_busy_class()
    {
        var busyClass = await api.CreateClassAsync(totalSeats: 5);
        var otherClass = await CreateClassInADifferentQueueThanAsync(busyClass);

        await using var fullQueue = FillApplicationQueue(busyClass);

        var application = await api.ApplyAsync(otherClass, Owner).WaitAsync(MustFinishWithin);

        Assert.Equal(HttpStatusCode.Created, application.StatusCode);
    }
}
