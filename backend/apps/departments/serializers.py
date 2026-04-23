from rest_framework import serializers
from .models import Department


class DepartmentSerializer(serializers.ModelSerializer):
    doctor_count = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = [
            'id', 'name', 'description', 'location',
            'contact_number', 'is_active', 'doctor_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_doctor_count(self, obj):
        return obj.doctors.count()