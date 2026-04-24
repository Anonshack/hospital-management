"""
Custom User Model - AbstractUser with Role-Based Access Control
"""

import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import RegexValidator


def avatar_upload_path(instance, filename):
    """Generate upload path for user avatars."""
    ext = filename.split('.')[-1]
    return f'avatars/{instance.id}/{uuid.uuid4().hex}.{ext}'


class User(AbstractUser):
    """
    Custom User model with role-based access control.
    Extends Django's AbstractUser with additional fields.
    """

    class Role(models.TextChoices):
        ADMIN = 'admin', _('Admin')
        DOCTOR = 'doctor', _('Doctor')
        NURSE = 'nurse', _('Nurse')
        RECEPTIONIST = 'receptionist', _('Receptionist')
        PATIENT = 'patient', _('Patient')

    # Override email to make it unique and required
    email = models.EmailField(_('email address'), unique=True)

    # Role
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.PATIENT,
        db_index=True,
    )

    # Contact
    phone_regex = RegexValidator(
        regex=r'^\+?1?\d{9,15}$',
        message="Phone number must be entered in the format: '+999999999'. Up to 15 digits allowed."
    )
    phone = models.CharField(
        validators=[phone_regex],
        max_length=17,
        blank=True,
        null=True,
    )

    # Profile
    avatar = models.ImageField(
        upload_to=avatar_upload_path,
        blank=True,
        null=True,
    )

    class Gender(models.TextChoices):
        MALE = 'male', _('Male')
        FEMALE = 'female', _('Female')

    gender = models.CharField(
        max_length=10,
        choices=Gender.choices,
        default=Gender.MALE,
        blank=True,
    )

    # Verification
    is_verified = models.BooleanField(default=False)
    verification_token = models.UUIDField(default=uuid.uuid4, editable=False)

    # Password Reset
    password_reset_token = models.UUIDField(null=True, blank=True)
    password_reset_token_expires = models.DateTimeField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Use email as username
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    class Meta:
        verbose_name = _('User')
        verbose_name_plural = _('Users')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['role']),
            models.Index(fields=['is_verified']),
        ]

    def __str__(self):
        return f"{self.get_full_name()} ({self.email}) - {self.role}"

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN

    @property
    def is_doctor(self):
        return self.role == self.Role.DOCTOR

    @property
    def is_nurse(self):
        return self.role == self.Role.NURSE

    @property
    def is_receptionist(self):
        return self.role == self.Role.RECEPTIONIST

    @property
    def is_patient_role(self):
        return self.role == self.Role.PATIENT

    def get_profile(self):
        """Get the role-specific profile for this user."""
        role_profile_map = {
            self.Role.DOCTOR: 'doctor_profile',
            self.Role.PATIENT: 'patient_profile',
        }
        attr = role_profile_map.get(self.role)
        if attr:
            return getattr(self, attr, None)
        return None
