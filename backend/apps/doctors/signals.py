from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.users.models import User
from apps.doctors.models import Doctor


@receiver(post_save, sender=User)
def create_doctor_profile(sender, instance, created, **kwargs):
    """Auto-create Doctor profile when a user with doctor role is saved."""
    if instance.role == User.Role.DOCTOR:
        Doctor.objects.get_or_create(
            user=instance,
            defaults={
                'specialization': 'General Medicine',
                'consultation_fee': 0,
                'experience_years': 0,
                'is_available': True,
            }
        )