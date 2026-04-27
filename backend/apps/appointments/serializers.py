from rest_framework import serializers
from django.utils import timezone
from .models import Appointment, AppointmentImage


class AppointmentImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = AppointmentImage
        fields = ['id', 'image', 'image_url', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_at']

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class PatientInlineSerializer(serializers.Serializer):
    """Inline patient data for appointment detail views."""
    id = serializers.IntegerField()
    full_name = serializers.CharField()
    email = serializers.CharField()
    blood_group = serializers.CharField()
    age = serializers.IntegerField(allow_null=True)
    address = serializers.CharField()
    insurance_number = serializers.CharField()
    emergency_contact_name = serializers.CharField()
    emergency_contact_phone = serializers.CharField()
    allergies = serializers.CharField()
    chronic_conditions = serializers.CharField()
    avatar = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()

    def get_avatar(self, obj):
        if obj.user.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.user.avatar.url)
            return obj.user.avatar.url
        return None

    def get_phone(self, obj):
        return obj.user.phone


class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    patient_email = serializers.CharField(source='patient.email', read_only=True)
    patient_blood_group = serializers.CharField(source='patient.blood_group', read_only=True)
    patient_age = serializers.IntegerField(source='patient.age', read_only=True)
    patient_address = serializers.CharField(source='patient.address', read_only=True)
    patient_insurance_number = serializers.CharField(source='patient.insurance_number', read_only=True)
    patient_emergency_contact_name = serializers.CharField(source='patient.emergency_contact_name', read_only=True)
    patient_emergency_contact_phone = serializers.CharField(source='patient.emergency_contact_phone', read_only=True)
    patient_allergies = serializers.CharField(source='patient.allergies', read_only=True)
    patient_chronic_conditions = serializers.CharField(source='patient.chronic_conditions', read_only=True)
    patient_avatar = serializers.SerializerMethodField()
    patient_phone = serializers.SerializerMethodField()
    doctor_name = serializers.CharField(source='doctor.full_name', read_only=True)
    doctor_specialization = serializers.CharField(source='doctor.specialization', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    images = AppointmentImageSerializer(many=True, read_only=True)

    class Meta:
        model = Appointment
        fields = [
            'id', 'patient', 'patient_name', 'patient_email', 'patient_blood_group',
            'patient_age', 'patient_address', 'patient_insurance_number',
            'patient_emergency_contact_name', 'patient_emergency_contact_phone',
            'patient_allergies', 'patient_chronic_conditions', 'patient_avatar', 'patient_phone',
            'doctor', 'doctor_name', 'doctor_specialization',
            'date', 'time', 'status', 'status_display',
            'reason', 'notes', 'symptoms', 'is_follow_up', 'follow_up_for',
            'cancellation_reason', 'images', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'cancelled_by']

    def get_patient_avatar(self, obj):
        if obj.patient.user.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.patient.user.avatar.url)
            return obj.patient.user.avatar.url
        return None

    def get_patient_phone(self, obj):
        return obj.patient.user.phone


class AppointmentCreateSerializer(serializers.ModelSerializer):
    uploaded_images = serializers.ListField(
        child=serializers.ImageField(),
        write_only=True,
        required=False,
        max_length=4,
    )

    class Meta:
        model = Appointment
        fields = ['patient', 'doctor', 'date', 'time', 'reason', 'symptoms',
                  'is_follow_up', 'follow_up_for', 'uploaded_images']
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
            from apps.doctors.models import DoctorSchedule
            day_of_week = date_val.weekday()
            if not DoctorSchedule.objects.filter(
                doctor=doctor, day_of_week=day_of_week, is_active=True
            ).exists():
                raise serializers.ValidationError({
                    'date': f"Doctor does not have a schedule for {date_val.strftime('%A')}."
                })

            existing = Appointment.objects.filter(
                doctor=doctor, date=date_val, time=time_val
            ).exclude(status=Appointment.Status.CANCELLED)
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise serializers.ValidationError({
                    'time': 'This time slot is already booked for the selected doctor.'
                })

        images = attrs.get('uploaded_images', [])
        if len(images) > 4:
            raise serializers.ValidationError({'uploaded_images': 'Maximum 4 images allowed.'})

        return attrs

    def create(self, validated_data):
        images = validated_data.pop('uploaded_images', [])
        appointment = Appointment.objects.create(**validated_data)
        for img in images:
            AppointmentImage.objects.create(appointment=appointment, image=img)
        return appointment

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
    patient_avatar = serializers.SerializerMethodField()
    doctor_name = serializers.CharField(source='doctor.full_name', read_only=True)
    doctor_specialization = serializers.CharField(source='doctor.specialization', read_only=True)
    images = AppointmentImageSerializer(many=True, read_only=True)

    class Meta:
        model = Appointment
        fields = ['id', 'patient', 'patient_name', 'patient_avatar', 'doctor_name',
                  'doctor_specialization', 'date', 'time', 'status', 'reason',
                  'symptoms', 'images', 'created_at']

    def get_patient_avatar(self, obj):
        if obj.patient.user.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.patient.user.avatar.url)
            return obj.patient.user.avatar.url
        return None
