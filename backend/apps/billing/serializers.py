"""
Billing Serializers
"""

from rest_framework import serializers
from django.utils import timezone
from .models import Billing


class BillingSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    balance_due = serializers.ReadOnlyField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Billing
        fields = [
            'id', 'patient', 'patient_name', 'appointment', 'invoice_number',
            'amount', 'discount', 'tax', 'total_amount', 'paid_amount', 'balance_due',
            'status', 'status_display', 'payment_method', 'payment_date',
            'description', 'notes', 'due_date', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'invoice_number', 'total_amount', 'created_at', 'updated_at']


class BillingCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Billing
        fields = [
            'patient', 'appointment', 'amount', 'discount', 'tax',
            'description', 'notes', 'due_date',
        ]


class PaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    payment_method = serializers.ChoiceField(choices=Billing.PaymentMethod.choices)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Payment amount must be positive.")
        return value
