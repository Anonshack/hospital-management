"""
Notification Model
"""

from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _


class Notification(models.Model):
    class Type(models.TextChoices):
        APPOINTMENT_BOOKED = 'appointment_booked', _('Appointment Booked')
        APPOINTMENT_APPROVED = 'appointment_approved', _('Appointment Approved')
        APPOINTMENT_CANCELLED = 'appointment_cancelled', _('Appointment Cancelled')
        APPOINTMENT_COMPLETED = 'appointment_completed', _('Appointment Completed')
        APPOINTMENT_REMINDER = 'appointment_reminder', _('Appointment Reminder')
        BILL_GENERATED = 'bill_generated', _('Bill Generated')
        BILL_PAID = 'bill_paid', _('Bill Paid')
        GENERAL = 'general', _('General')

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    notification_type = models.CharField(max_length=50, choices=Type.choices, default=Type.GENERAL)
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Notification')
        verbose_name_plural = _('Notifications')
        ordering = ['-created_at']
        indexes = [models.Index(fields=['recipient', 'is_read', 'created_at'])]

    def __str__(self):
        return f"{self.title} → {self.recipient.email}"
