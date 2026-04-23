from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator


class Doctor(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='doctor_profile',
    )
    department = models.ForeignKey(
        'departments.Department',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='doctors',
    )
    specialization = models.CharField(max_length=200)
    qualification = models.CharField(max_length=300, blank=True)
    experience_years = models.PositiveIntegerField(default=0)
    consultation_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    bio = models.TextField(blank=True)
    is_available = models.BooleanField(default=True)
    license_number = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Dr. {self.user.get_full_name()} - {self.specialization}"

    @property
    def full_name(self):
        return f"Dr. {self.user.get_full_name()}"

    @property
    def email(self):
        return self.user.email


class DoctorSchedule(models.Model):
    """Doctor har kun uchun alohida jadval"""

    DAYS = [
        (0, 'Monday'),
        (1, 'Tuesday'),
        (2, 'Wednesday'),
        (3, 'Thursday'),
        (4, 'Friday'),
        (5, 'Saturday'),
        (6, 'Sunday'),
    ]

    doctor = models.ForeignKey(
        Doctor,
        on_delete=models.CASCADE,
        related_name='schedules',
    )
    day_of_week = models.IntegerField(choices=DAYS)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_active = models.BooleanField(default=True)
    slot_duration = models.IntegerField(default=30, help_text="Minutes per slot")

    class Meta:
        unique_together = ['doctor', 'day_of_week']
        ordering = ['day_of_week', 'start_time']

    def __str__(self):
        return f"Dr. {self.doctor.full_name} - {self.get_day_of_week_display()} {self.start_time}-{self.end_time}"

    def get_time_slots(self):
        """Ish vaqtiga qarab time slotlarni qaytaradi"""
        from datetime import datetime, timedelta
        slots = []
        current = datetime.combine(datetime.today(), self.start_time)
        end = datetime.combine(datetime.today(), self.end_time)
        while current < end:
            slots.append(current.strftime('%H:%M'))
            current += timedelta(minutes=self.slot_duration)
        return slots