"""
Appointment Serializers
"""

from rest_framework import serializers
from django.utils import timezone
from .models import Appointment


class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    doctor_name = serializers.CharField(source='doctor.full_name', read_only=True)
    doctor_specialization = serializers.CharField(source='doctor.specialization', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Appointment
        fields = [
            'id', 'patient', 'patient_name', 'doctor', 'doctor_name',
            'doctor_specialization', 'date', 'time', 'status', 'status_display',
            'reason', 'notes', 'symptoms', 'is_follow_up', 'follow_up_for',
            'cancellation_reason', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'cancelled_by']


class AppointmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = ['patient', 'doctor', 'date', 'time', 'reason', 'symptoms', 'is_follow_up', 'follow_up_for']

    def validate(self, attrs):
        date = attrs.get('date')
        time = attrs.get('time')
        doctor = attrs.get('doctor')

        if date and date < timezone.now().date():
            raise serializers.ValidationError({'date': 'Appointment date cannot be in the past.'})

        # Check doctor availability
        if doctor and not doctor.is_available:
            raise serializers.ValidationError({'doctor': 'This doctor is currently not available.'})

        # Check for double-booking (excluding cancelled)
        if doctor and date and time:
            existing = Appointment.objects.filter(
                doctor=doctor, date=date, time=time
            ).exclude(status=Appointment.Status.CANCELLED)
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise serializers.ValidationError(
                    {'time': 'This time slot is already booked for the selected doctor.'}
                )
        return attrs


class AppointmentStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = ['status', 'notes', 'cancellation_reason']

    def validate_status(self, value):
        allowed_transitions = {
            Appointment.Status.PENDING: [Appointment.Status.APPROVED, Appointment.Status.CANCELLED],
            Appointment.Status.APPROVED: [Appointment.Status.COMPLETED, Appointment.Status.CANCELLED, Appointment.Status.NO_SHOW],
            Appointment.Status.CANCELLED: [],
            Appointment.Status.COMPLETED: [],
            Appointment.Status.NO_SHOW: [],
        }
        current_status = self.instance.status if self.instance else None
        if current_status and value not in allowed_transitions.get(current_status, []):
            raise serializers.ValidationError(
                f"Cannot transition from '{current_status}' to '{value}'."
            )
        return value


class AppointmentListSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    doctor_name = serializers.CharField(source='doctor.full_name', read_only=True)

    class Meta:
        model = Appointment
        fields = ['id', 'patient_name', 'doctor_name', 'date', 'time', 'status', 'reason', 'created_at']
