"""
Medical Record Serializers
"""

from rest_framework import serializers
from .models import MedicalRecord, Prescription


class PrescriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Prescription
        fields = ['id', 'medicine_name', 'dosage', 'frequency', 'duration', 'instructions', 'quantity']


class MedicalRecordSerializer(serializers.ModelSerializer):
    prescriptions = PrescriptionSerializer(many=True, read_only=True)
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    doctor_name = serializers.CharField(source='doctor.full_name', read_only=True)
    report_file_url = serializers.SerializerMethodField()

    class Meta:
        model = MedicalRecord
        fields = [
            'id', 'patient', 'patient_name', 'doctor', 'doctor_name',
            'appointment', 'diagnosis', 'prescription', 'notes',
            'chief_complaint', 'vital_signs', 'report_file', 'report_file_url',
            'follow_up_date', 'is_confidential', 'prescriptions',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_report_file_url(self, obj):
        if obj.report_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.report_file.url)
        return None


class MedicalRecordCreateSerializer(serializers.ModelSerializer):
    prescriptions = PrescriptionSerializer(many=True, required=False)

    class Meta:
        model = MedicalRecord
        fields = [
            'patient', 'doctor', 'appointment', 'diagnosis', 'prescription',
            'notes', 'chief_complaint', 'vital_signs', 'report_file',
            'follow_up_date', 'is_confidential', 'prescriptions',
        ]

    def create(self, validated_data):
        prescriptions_data = validated_data.pop('prescriptions', [])
        record = MedicalRecord.objects.create(**validated_data)
        for p_data in prescriptions_data:
            Prescription.objects.create(medical_record=record, **p_data)
        return record

    def update(self, instance, validated_data):
        prescriptions_data = validated_data.pop('prescriptions', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if prescriptions_data is not None:
            instance.prescriptions.all().delete()
            for p_data in prescriptions_data:
                Prescription.objects.create(medical_record=instance, **p_data)
        return instance
