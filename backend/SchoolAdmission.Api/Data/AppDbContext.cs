using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Models;

namespace SchoolAdmission.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<SchoolClass> Classes => Set<SchoolClass>();
    public DbSet<Hold> Holds => Set<Hold>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<SchoolClass>(entity =>
        {
            entity.ToTable("classes", table =>
                table.HasCheckConstraint("ck_classes_total_seats_positive", "total_seats > 0"));

            entity.HasKey(c => c.Id);
            entity.Property(c => c.Id).HasColumnName("id");
            entity.Property(c => c.Name).HasColumnName("name").HasMaxLength(200);
            entity.Property(c => c.TotalSeats).HasColumnName("total_seats");
            entity.Property(c => c.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
        });

        modelBuilder.Entity<Hold>(entity =>
        {
            entity.ToTable("holds", table =>
            {
                table.HasCheckConstraint(
                    "ck_holds_status",
                    "status IN ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')");
                table.HasCheckConstraint(
                    "ck_holds_student_id_format",
                    "student_id ~ '^[0-9]{17}$'");
            });

            entity.HasKey(h => h.Id);
            entity.Property(h => h.Id).HasColumnName("id");
            entity.Property(h => h.ClassId).HasColumnName("class_id");
            entity.Property(h => h.StudentId).HasColumnName("student_id").HasMaxLength(17);
            entity.Property(h => h.Status).HasColumnName("status").HasMaxLength(20);
            entity.Property(h => h.ExpiresAt).HasColumnName("expires_at");
            entity.Property(h => h.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            entity.Property(h => h.ConfirmedAt).HasColumnName("confirmed_at");
            entity.Property(h => h.CancelledAt).HasColumnName("cancelled_at");

            entity.HasOne<SchoolClass>()
                .WithMany()
                .HasForeignKey(h => h.ClassId)
                .HasConstraintName("fk_holds_class")
                .OnDelete(DeleteBehavior.Restrict);

            // The database itself refuses a second active application, even if application code has a bug.
            // Expired and cancelled rows are excluded, so a student can apply again after those.
            entity.HasIndex(h => new { h.ClassId, h.StudentId })
                .IsUnique()
                .HasFilter("status IN ('HELD', 'CONFIRMED')")
                .HasDatabaseName("ux_holds_one_active_per_student_and_class");

            entity.HasIndex(h => h.StudentId).HasDatabaseName("ix_holds_student_id");

            entity.HasIndex(h => h.ExpiresAt)
                .HasFilter("status = 'HELD'")
                .HasDatabaseName("ix_holds_expiring");
        });
    }
}
