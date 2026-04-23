"""
Notification Service - Handles email and in-app notifications
"""

import logging
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


class NotificationService:
    """
    Centralized service for creating notifications and sending emails.
    """

    @staticmethod
    def create_in_app(recipient, title, message, notification_type='general', data=None):
        """Create an in-app notification."""
        from .models import Notification
        try:
            return Notification.objects.create(
                recipient=recipient,
                title=title,
                message=message,
                notification_type=notification_type,
                data=data or {},
            )
        except Exception as e:
            logger.error(f"Failed to create notification for {recipient.email}: {e}")
            return None

    @staticmethod
    def send_email(subject, message, recipient_email, html_message=None):
        """Send an email notification."""
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient_email],
                html_message=html_message,
                fail_silently=False,
            )
            logger.info(f"Email sent to {recipient_email}: {subject}")
        except Exception as e:
            logger.error(f"Failed to send email to {recipient_email}: {e}")

    @classmethod
    def send_verification_email(cls, user):
        """Send email verification link."""
        verify_url = f"{settings.FRONTEND_URL}/verify-email/{user.verification_token}"
        subject = "Verify Your Email - Hospital Management System"
        message = (
            f"Hello {user.get_full_name()},\n\n"
            f"Please verify your email by clicking the link below:\n{verify_url}\n\n"
            f"If you did not register, ignore this email.\n\nThank you."
        )
        cls.send_email(subject, message, user.email)

    @classmethod
    def send_password_reset_email(cls, user, token):
        """Send password reset link."""
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        subject = "Password Reset Request - Hospital Management System"
        message = (
            f"Hello {user.get_full_name()},\n\n"
            f"Click the link below to reset your password (expires in 2 hours):\n{reset_url}\n\n"
            f"If you did not request this, ignore this email."
        )
        cls.send_email(subject, message, user.email)

    @classmethod
    def send_appointment_confirmation(cls, appointment):
        """Send appointment booking confirmation."""
        patient_user = appointment.patient.user
        doctor_user = appointment.doctor.user

        # Patient notification
        cls.create_in_app(
            recipient=patient_user,
            title="Appointment Booked",
            message=f"Your appointment with {appointment.doctor.full_name} on {appointment.date} at {appointment.time} has been booked.",
            notification_type='appointment_booked',
            data={'appointment_id': appointment.id},
        )
        cls.send_email(
            subject="Appointment Confirmation",
            message=(
                f"Hello {patient_user.get_full_name()},\n\n"
                f"Your appointment has been booked:\n"
                f"Doctor: {appointment.doctor.full_name}\n"
                f"Date: {appointment.date}\nTime: {appointment.time}\n"
                f"Reason: {appointment.reason or 'N/A'}\n\nPlease arrive 10 minutes early."
            ),
            recipient_email=patient_user.email,
        )

        # Doctor notification
        cls.create_in_app(
            recipient=doctor_user,
            title="New Appointment",
            message=f"New appointment from {appointment.patient.full_name} on {appointment.date} at {appointment.time}.",
            notification_type='appointment_booked',
            data={'appointment_id': appointment.id},
        )

    @classmethod
    def send_appointment_status_update(cls, appointment):
        """Send appointment status change notification."""
        patient_user = appointment.patient.user
        status_messages = {
            'approved': ('Appointment Approved', f"Your appointment with {appointment.doctor.full_name} on {appointment.date} at {appointment.time} has been approved."),
            'cancelled': ('Appointment Cancelled', f"Your appointment with {appointment.doctor.full_name} on {appointment.date} at {appointment.time} has been cancelled."),
            'completed': ('Appointment Completed', f"Your appointment with {appointment.doctor.full_name} on {appointment.date} has been marked as completed."),
        }
        title, message = status_messages.get(appointment.status, ('Appointment Update', 'Your appointment status has been updated.'))
        cls.create_in_app(
            recipient=patient_user,
            title=title,
            message=message,
            notification_type=f'appointment_{appointment.status}',
            data={'appointment_id': appointment.id},
        )
        cls.send_email(subject=title, message=f"Hello {patient_user.get_full_name()},\n\n{message}", recipient_email=patient_user.email)
