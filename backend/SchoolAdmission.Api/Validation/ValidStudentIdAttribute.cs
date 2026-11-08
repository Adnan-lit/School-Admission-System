using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;

namespace SchoolAdmission.Api.Validation;

/// <summary>
/// Requires a 17-digit birth registration number. It derives from RequiredAttribute because
/// ASP.NET only validates a missing header when the value is marked as required.
/// </summary>
public sealed partial class ValidStudentIdAttribute : RequiredAttribute
{
    public ValidStudentIdAttribute() =>
        ErrorMessage = "The X-Student-Id header must be the student's 17-digit birth registration number.";

    public override bool IsValid(object? value) => value is string text && Format().IsMatch(text);

    // [0-9] rather than \d, because \d in .NET also accepts digits from other scripts, including Bangla.
    [GeneratedRegex(@"\A[0-9]{17}\z")]
    private static partial Regex Format();
}
