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
        extra_kwargs = {
            'patient': {'required': False},
            'reason': {'required': True, 'allow_blank': False},
            'symptoms': {'required': False, 'allow_blank': True},
            'is_follow_up': {'required': False},
            'follow_up_for': {'required': False},
        }

    def validate_date(self, value):
        if value < timezone.now().date():
            raise serializers.ValidationError('Appointment date cannot be in the past.')
        return value

    def validate(self, attrs):
        doctor = attrs.get('doctor')
        date_val = attrs.get('date')
        time_val = attrs.get('time')

        if doctor and not doctor.is_available:
            raise serializers.ValidationError({'doctor': 'This doctor is currently not available.'})

        if doctor and date_val and time_val:
            # Check doctor has schedule for that day
            from apps.doctors.models import DoctorSchedule
            day_of_week = date_val.weekday()
            if not DoctorSchedule.objects.filter(
                doctor=doctor, day_of_week=day_of_week, is_active=True
            ).exists():
                raise serializers.ValidationError({
                    'date': f"Doctor does not have a schedule for {date_val.strftime('%A')}."
                })

            # Check double booking
            existing = Appointment.objects.filter(
                doctor=doctor, date=date_val, time=time_val
            ).exclude(status=Appointment.Status.CANCELLED)
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise serializers.ValidationError({
                    'time': 'This time slot is already booked for the selected doctor.'
                })

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
    doctor_specialization = serializers.CharField(source='doctor.specialization', read_only=True)

    class Meta:
        model = Appointment
        fields = ['id', 'patient_name', 'doctor_name', 'doctor_specialization',
                  'date', 'time', 'status', 'reason', 'created_at']
