"""
Medical Record and Prescription Models
"""

import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _


def report_upload_path(instance, filename):
    ext = filename.split('.')[-1]
    return f'medical_reports/{instance.patient.id}/{uuid.uuid4().hex}.{ext}'


class MedicalRecord(models.Model):
    patient = models.ForeignKey(
        'patients.Patient',
        on_delete=models.CASCADE,
        related_name='medical_records',
    )
    doctor = models.ForeignKey(
        'doctors.Doctor',
        on_delete=models.SET_NULL,
        null=True,
        related_name='medical_records',
    )
    appointment = models.OneToOneField(
        'appointments.Appointment',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='medical_record',
    )
    diagnosis = models.TextField()
    prescription = models.TextField(blank=True, help_text="General prescription notes")
    notes = models.TextField(blank=True)
    chief_complaint = models.TextField(blank=True)
    vital_signs = models.JSONField(
        default=dict,
        blank=True,
        help_text='e.g. {"bp": "120/80", "temp": "98.6", "pulse": "72", "weight": "70kg"}'
    )
    report_file = models.FileField(
        upload_to=report_upload_path,
        null=True, blank=True,
        help_text="Attach medical report PDF/image"
    )
    follow_up_date = models.DateField(null=True, blank=True)
    is_confidential = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Medical Record')
        verbose_name_plural = _('Medical Records')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['patient', 'created_at']),
            models.Index(fields=['doctor', 'created_at']),
        ]

    def __str__(self):
        return f"Record: {self.patient.full_name} by Dr. {self.doctor.full_name if self.doctor else 'N/A'} on {self.created_at.date()}"


class Prescription(models.Model):
    medical_record = models.ForeignKey(
        MedicalRecord,
        on_delete=models.CASCADE,
        related_name='prescriptions',
    )
    medicine_name = models.CharField(max_length=200)
    dosage = models.CharField(max_length=100, help_text="e.g., 500mg")
    frequency = models.CharField(max_length=100, blank=True, help_text="e.g., Twice daily")
    duration = models.CharField(max_length=100, help_text="e.g., 7 days")
    instructions = models.TextField(blank=True, help_text="Special instructions")
    quantity = models.CharField(max_length=50, blank=True)

    class Meta:
        verbose_name = _('Prescription')
        verbose_name_plural = _('Prescriptions')

    def __str__(self):
        return f"{self.medicine_name} - {self.dosage} for {self.duration}"
