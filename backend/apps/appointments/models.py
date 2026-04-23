"""
Appointment Model
"""

from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError
from django.utils import timezone


class Appointment(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', _('Pending')
        APPROVED = 'approved', _('Approved')
        CANCELLED = 'cancelled', _('Cancelled')
        COMPLETED = 'completed', _('Completed')
        NO_SHOW = 'no_show', _('No Show')

    patient = models.ForeignKey(
        'patients.Patient',
        on_delete=models.CASCADE,
        related_name='appointments',
    )
    doctor = models.ForeignKey(
        'doctors.Doctor',
        on_delete=models.CASCADE,
        related_name='appointments',
    )
    date = models.DateField()
    time = models.TimeField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    reason = models.TextField(blank=True, help_text="Reason for appointment")
    notes = models.TextField(blank=True, help_text="Doctor/staff notes")
    symptoms = models.TextField(blank=True)
    is_follow_up = models.BooleanField(default=False)
    follow_up_for = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='follow_ups',
    )
    cancelled_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='cancelled_appointments',
    )
    cancellation_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Appointment')
        verbose_name_plural = _('Appointments')
        ordering = ['-date', '-time']
        indexes = [
            models.Index(fields=['doctor', 'date', 'status']),
            models.Index(fields=['patient', 'date']),
        ]
        # Prevent double-booking
        constraints = [
            models.UniqueConstraint(
                fields=['doctor', 'date', 'time'],
                condition=~models.Q(status='cancelled'),
                name='unique_doctor_datetime_active',
            )
        ]

    def __str__(self):
        return f"{self.patient.full_name} → Dr. {self.doctor.full_name} on {self.date} at {self.time}"

    def clean(self):
        if self.date and self.date < timezone.now().date():
            if not self.pk:  # Only validate on create
                raise ValidationError("Appointment date cannot be in the past.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
