using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace SchoolAdmission.Tests;

[Collection(nameof(ApiCollection))]
public class HoldLifecycleTests(ApiFixture fixture)
{
    private const string WholeSecondUtc = @"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$";

    private static readonly string Owner = AdmissionClient.StudentId(1);
    private static readonly string OtherStudent = AdmissionClient.StudentId(2);

    private readonly AdmissionClient api = new(fixture.CreateClient());

    [Fact]
    public async Task Looking_up_a_hold_needs_no_student_id_and_returns_the_contract_fields()
    {
        var classId = await api.CreateClassAsync(totalSeats: 5);
        var holdId = await api.ApplyForHoldIdAsync(classId, Owner);

        var response = await api.GetHoldAsync(holdId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var hold = body.RootElement;
        Assert.Equal(holdId, hold.GetProperty("holdId").GetString());
        Assert.Equal(classId, hold.GetProperty("classId").GetString());
        Assert.Equal("HELD", hold.GetProperty("status").GetString());
        Assert.Matches(WholeSecondUtc, hold.GetProperty("expiresAt").GetString());
    }

    [Theory]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    [InlineData("not-a-real-id")]
    public async Task Unknown_holds_return_404_for_every_operation(string holdId)
    {
        Assert.Equal(HttpStatusCode.NotFound, (await api.GetHoldAsync(holdId)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await api.ConfirmAsync(holdId, Owner)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await api.CancelAsync(holdId, Owner)).StatusCode);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("12345")]
    public async Task A_missing_or_invalid_student_id_returns_400_for_every_operation(string? studentId)
    {
        var classId = await api.CreateClassAsync(totalSeats: 5);
        var holdId = await api.ApplyForHoldIdAsync(classId, Owner);

        Assert.Equal(HttpStatusCode.BadRequest, (await api.ConfirmAsync(holdId, studentId)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await api.CancelAsync(holdId, studentId)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await api.GetMyHoldsAsync(studentId)).StatusCode);
    }

    [Fact]
    public async Task Confirming_returns_the_contract_fields_and_moves_the_seat_to_confirmed()
    {
        var classId = await api.CreateClassAsync(totalSeats: 5);
        var holdId = await api.ApplyForHoldIdAsync(classId, Owner);

        var response = await api.ConfirmAsync(holdId, Owner);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(holdId, body.RootElement.GetProperty("holdId").GetString());
        Assert.Equal("CONFIRMED", body.RootElement.GetProperty("status").GetString());

        var seats = await api.GetSeatsAsync(classId);
        Assert.Equal(0, seats.HeldSeats);
        Assert.Equal(1, seats.ConfirmedSeats);
        Assert.Equal(4, seats.AvailableSeats);
    }

    [Fact]
    public async Task Confirming_someone_elses_hold_returns_403_and_changes_nothing()
    {
        var classId = await api.CreateClassAsync(totalSeats: 5);
        var holdId = await api.ApplyForHoldIdAsync(classId, Owner);

        var response = await api.ConfirmAsync(holdId, OtherStudent);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var seats = await api.GetSeatsAsync(classId);
        Assert.Equal(1, seats.HeldSeats);
        Assert.Equal(0, seats.ConfirmedSeats);
    }

    [Fact]
    public async Task Confirming_the_same_hold_twice_succeeds_and_counts_once()
    {
        var classId = await api.CreateClassAsync(totalSeats: 5);
        var holdId = await api.ApplyForHoldIdAsync(classId, Owner);

        var first = await api.ConfirmAsync(holdId, Owner);
        var second = await api.ConfirmAsync(holdId, Owner);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.Equal(1, (await api.GetSeatsAsync(classId)).ConfirmedSeats);
    }

    [Fact]
    public async Task Twenty_simultaneous_confirms_of_one_hold_count_once()
    {
        var classId = await api.CreateClassAsync(totalSeats: 5);
        var holdId = await api.ApplyForHoldIdAsync(classId, Owner);

        var responses = await AdmissionClient.SendAllAtOnceAsync(20, _ => api.ConfirmAsync(holdId, Owner));

        Assert.All(responses, response => Assert.Equal(HttpStatusCode.OK, response.StatusCode));
        var seats = await api.GetSeatsAsync(classId);
        Assert.Equal(1, seats.ConfirmedSeats);
        Assert.Equal(0, seats.HeldSeats);
    }

    [Fact]
    public async Task Confirming_a_cancelled_hold_returns_409()
    {
        var classId = await api.CreateClassAsync(totalSeats: 5);
        var holdId = await api.ApplyForHoldIdAsync(classId, Owner);
        await api.CancelAsync(holdId, Owner);

        var response = await api.ConfirmAsync(holdId, Owner);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("HOLD_CANCELLED", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Cancelling_returns_204_and_releases_the_seat()
    {
        var classId = await api.CreateClassAsync(totalSeats: 1);
        var holdId = await api.ApplyForHoldIdAsync(classId, Owner);

        var response = await api.CancelAsync(holdId, Owner);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(1, (await api.GetSeatsAsync(classId)).AvailableSeats);
    }

    [Fact]
    public async Task Cancelling_twice_returns_204_both_times()
    {
        var classId = await api.CreateClassAsync(totalSeats: 1);
        var holdId = await api.ApplyForHoldIdAsync(classId, Owner);

        Assert.Equal(HttpStatusCode.NoContent, (await api.CancelAsync(holdId, Owner)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await api.CancelAsync(holdId, Owner)).StatusCode);
    }

    [Fact]
    public async Task Cancelling_someone_elses_hold_returns_403_and_keeps_the_seat()
    {
        var classId = await api.CreateClassAsync(totalSeats: 1);
        var holdId = await api.ApplyForHoldIdAsync(classId, Owner);

        var response = await api.CancelAsync(holdId, OtherStudent);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(1, (await api.GetSeatsAsync(classId)).HeldSeats);
    }

    [Fact]
    public async Task Cancelling_a_confirmed_admission_returns_409_and_keeps_the_seat()
    {
        var classId = await api.CreateClassAsync(totalSeats: 1);
        var holdId = await api.ApplyForHoldIdAsync(classId, Owner);
        await api.ConfirmAsync(holdId, Owner);

        var response = await api.CancelAsync(holdId, Owner);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("HOLD_CONFIRMED", await response.Content.ReadAsStringAsync());
        Assert.Equal(1, (await api.GetSeatsAsync(classId)).ConfirmedSeats);
    }

    [Fact]
    public async Task A_student_can_apply_again_after_cancelling()
    {
        var classId = await api.CreateClassAsync(totalSeats: 1);
        var holdId = await api.ApplyForHoldIdAsync(classId, Owner);
        await api.CancelAsync(holdId, Owner);

        var response = await api.ApplyAsync(classId, Owner);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task A_cancelled_seat_can_be_taken_by_another_student()
    {
        var classId = await api.CreateClassAsync(totalSeats: 1);
        var holdId = await api.ApplyForHoldIdAsync(classId, Owner);
        await api.CancelAsync(holdId, Owner);

        var response = await api.ApplyAsync(classId, OtherStudent);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task A_student_with_a_confirmed_admission_cannot_apply_again()
    {
        var classId = await api.CreateClassAsync(totalSeats: 5);
        var holdId = await api.ApplyForHoldIdAsync(classId, Owner);
        await api.ConfirmAsync(holdId, Owner);

        var response = await api.ApplyAsync(classId, Owner);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("ALREADY_APPLIED", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Confirm_and_cancel_racing_on_the_same_hold_have_exactly_one_winner()
    {
        const int races = 30;
        var classId = await api.CreateClassAsync(races);
        var students = Enumerable.Range(0, races).Select(AdmissionClient.StudentId).ToArray();
        var holdIds = new string[races];
        for (var index = 0; index < races; index++)
        {
            holdIds[index] = await api.ApplyForHoldIdAsync(classId, students[index]);
        }

        // Even-numbered requests confirm and odd-numbered requests cancel, two for each hold.
        var responses = await AdmissionClient.SendAllAtOnceAsync(
            races * 2,
            number => number % 2 == 0
                ? api.ConfirmAsync(holdIds[number / 2], students[number / 2])
                : api.CancelAsync(holdIds[number / 2], students[number / 2]));

        var confirmedWins = 0;
        for (var index = 0; index < races; index++)
        {
            var confirmWon = responses[index * 2].StatusCode == HttpStatusCode.OK;
            var cancelWon = responses[(index * 2) + 1].StatusCode == HttpStatusCode.NoContent;
            Assert.True(confirmWon != cancelWon, $"Race {index}: confirm won={confirmWon}, cancel won={cancelWon}");
            confirmedWins += confirmWon ? 1 : 0;
        }

        var seats = await api.GetSeatsAsync(classId);
        Assert.Equal(confirmedWins, seats.ConfirmedSeats);
        Assert.Equal(0, seats.HeldSeats);
        Assert.Equal(races - confirmedWins, seats.AvailableSeats);
    }

    [Fact]
    public async Task My_holds_lists_all_of_this_students_applications_and_no_one_elses()
    {
        var student = AdmissionClient.NewStudentId();
        var heldClass = await api.CreateClassAsync(totalSeats: 5);
        var confirmedClass = await api.CreateClassAsync(totalSeats: 5);
        var cancelledClass = await api.CreateClassAsync(totalSeats: 5);

        var held = await api.ApplyForHoldIdAsync(heldClass, student);
        var confirmed = await api.ApplyForHoldIdAsync(confirmedClass, student);
        await api.ConfirmAsync(confirmed, student);
        var cancelled = await api.ApplyForHoldIdAsync(cancelledClass, student);
        await api.CancelAsync(cancelled, student);
        await api.ApplyForHoldIdAsync(heldClass, AdmissionClient.NewStudentId());

        var response = await api.GetMyHoldsAsync(student);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var holds = await response.Content.ReadFromJsonAsync<MyHold[]>();
        Assert.Equal(3, holds!.Length);
        Assert.Equal("HELD", holds.Single(h => h.HoldId == held).Status);
        Assert.Equal("CONFIRMED", holds.Single(h => h.HoldId == confirmed).Status);
        Assert.Equal("CANCELLED", holds.Single(h => h.HoldId == cancelled).Status);
        Assert.All(holds, hold =>
        {
            Assert.Equal("Test class", hold.ClassName);
            Assert.Matches(WholeSecondUtc, hold.ExpiresAt);
        });
        Assert.Equal(heldClass, holds.Single(h => h.HoldId == held).ClassId);
    }

    [Fact]
    public async Task My_holds_is_an_empty_list_for_a_student_with_no_applications()
    {
        var response = await api.GetMyHoldsAsync(AdmissionClient.NewStudentId());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("[]", await response.Content.ReadAsStringAsync());
    }
}
