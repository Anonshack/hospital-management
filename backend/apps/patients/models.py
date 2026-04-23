"""
Patient Model and related models
"""

from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _


class Patient(models.Model):
    """
    Patient profile linked to User model.
    Stores patient-specific medical information.
    """

    class BloodGroup(models.TextChoices):
        A_POS = 'A+', _('A+')
        A_NEG = 'A-', _('A-')
        B_POS = 'B+', _('B+')
        B_NEG = 'B-', _('B-')
        AB_POS = 'AB+', _('AB+')
        AB_NEG = 'AB-', _('AB-')
        O_POS = 'O+', _('O+')
        O_NEG = 'O-', _('O-')
        UNKNOWN = 'Unknown', _('Unknown')

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='patient_profile',
        limit_choices_to={'role': 'patient'},
    )
    blood_group = models.CharField(
        max_length=10,
        choices=BloodGroup.choices,
        default=BloodGroup.UNKNOWN,
    )
    date_of_birth = models.DateField(null=True, blank=True)
    address = models.TextField(blank=True)
    emergency_contact_name = models.CharField(max_length=100, blank=True)
    emergency_contact_phone = models.CharField(max_length=17, blank=True)
    allergies = models.TextField(blank=True, help_text="Known allergies")
    chronic_conditions = models.TextField(blank=True, help_text="Chronic medical conditions")
    insurance_number = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Patient')
        verbose_name_plural = _('Patients')
        ordering = ['-created_at']

    def __str__(self):
        return f"Patient: {self.user.get_full_name()}"

    @property
    def age(self):
        """Calculate patient age from date of birth."""
        if self.date_of_birth:
            from datetime import date
            today = date.today()
            return today.year - self.date_of_birth.year - (
                (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
            )
        return None

    @property
    def full_name(self):
        return self.user.get_full_name()

    @property
    def email(self):
        return self.user.email
