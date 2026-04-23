from rest_framework import serializers
from apps.users.serializers import UserProfileSerializer
from .models import Doctor, DoctorSchedule


class DoctorScheduleSerializer(serializers.ModelSerializer):
    day_name = serializers.CharField(source='get_day_of_week_display', read_only=True)
    time_slots = serializers.SerializerMethodField()

    class Meta:
        model = DoctorSchedule
        fields = ['id', 'day_of_week', 'day_name', 'start_time', 'end_time',
                  'is_active', 'slot_duration', 'time_slots']

    def get_time_slots(self, obj):
        if obj.is_active:
            return obj.get_time_slots()
        return []


class DoctorSerializer(serializers.ModelSerializer):
    user = UserProfileSerializer(read_only=True)
    full_name = serializers.ReadOnlyField()
    email = serializers.ReadOnlyField()
    department_name = serializers.CharField(source='department.name', read_only=True)
    schedules = DoctorScheduleSerializer(many=True, read_only=True)
    avatar = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()

    class Meta:
        model = Doctor
        fields = [
            'id', 'user', 'full_name', 'email', 'avatar', 'phone',
            'department', 'department_name',
            'specialization', 'qualification', 'experience_years',
            'consultation_fee', 'bio', 'is_available',
            'license_number', 'schedules', 'created_at', 'updated_at',
        ]

    def get_avatar(self, obj):
        if obj.user.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.user.avatar.url)
        return None

    def get_phone(self, obj):
        return obj.user.phone


class DoctorUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Doctor
        fields = [
            'department', 'specialization', 'qualification',
            'experience_years', 'consultation_fee', 'bio',
            'is_available', 'license_number',
        ]


class DoctorListSerializer(serializers.ModelSerializer):
    """
    List serializer — includes schedules so booking page can show
    working days/hours without a separate request.
    """
    full_name = serializers.ReadOnlyField()
    department_name = serializers.CharField(source='department.name', read_only=True)
    avatar = serializers.SerializerMethodField()
    schedules = DoctorScheduleSerializer(many=True, read_only=True)
    email = serializers.ReadOnlyField()

    class Meta:
        model = Doctor
        fields = [
            'id', 'full_name', 'email', 'specialization', 'department_name',
            'experience_years', 'consultation_fee', 'is_available',
            'avatar', 'bio', 'schedules',
        ]

    def get_avatar(self, obj):
        if obj.user.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.user.avatar.url)
        return None