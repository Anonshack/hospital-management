"""
Patient Serializers
"""

from rest_framework import serializers
from apps.users.serializers import UserProfileSerializer
from .models import Patient


class PatientSerializer(serializers.ModelSerializer):
    user = UserProfileSerializer(read_only=True)
    age = serializers.ReadOnlyField()
    full_name = serializers.ReadOnlyField()
    email = serializers.ReadOnlyField()

    class Meta:
        model = Patient
        fields = [
            'id', 'user', 'full_name', 'email', 'blood_group',
            'date_of_birth', 'age', 'address', 'emergency_contact_name',
            'emergency_contact_phone', 'allergies', 'chronic_conditions',
            'insurance_number', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PatientUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = [
            'blood_group', 'date_of_birth', 'address',
            'emergency_contact_name', 'emergency_contact_phone',
            'allergies', 'chronic_conditions', 'insurance_number',
        ]


class PatientListSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    email = serializers.ReadOnlyField()
    age = serializers.ReadOnlyField()

    class Meta:
        model = Patient
        fields = ['id', 'full_name', 'email', 'age', 'blood_group', 'created_at']
