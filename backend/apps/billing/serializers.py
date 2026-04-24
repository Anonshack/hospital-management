from rest_framework import serializers
from django.utils import timezone
from .models import Billing, PaymentReceipt


class PaymentReceiptSerializer(serializers.ModelSerializer):
    receipt_image_url = serializers.SerializerMethodField()
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    confirmed_by_name = serializers.CharField(source='confirmed_by.get_full_name', read_only=True)

    class Meta:
        model = PaymentReceipt
        fields = [
            'id', 'billing', 'patient', 'patient_name', 'card_number',
            'amount', 'receipt_image', 'receipt_image_url', 'note',
            'status', 'confirmed_by', 'confirmed_by_name', 'confirmed_at', 'created_at',
        ]
        read_only_fields = ['id', 'patient', 'status', 'confirmed_by', 'confirmed_at', 'created_at']

    def get_receipt_image_url(self, obj):
        if obj.receipt_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.receipt_image.url)
            return obj.receipt_image.url
        return None


class BillingSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    balance_due = serializers.ReadOnlyField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    receipts = PaymentReceiptSerializer(many=True, read_only=True)
    latest_receipt = serializers.SerializerMethodField()

    class Meta:
        model = Billing
        fields = [
            'id', 'patient', 'patient_name', 'appointment', 'invoice_number',
            'amount', 'discount', 'tax', 'total_amount', 'paid_amount', 'balance_due',
            'status', 'status_display', 'payment_method', 'payment_date',
            'description', 'notes', 'due_date', 'receipts', 'latest_receipt',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'invoice_number', 'total_amount', 'created_at', 'updated_at']

    def get_latest_receipt(self, obj):
        receipt = obj.receipts.first()
        if receipt:
            return PaymentReceiptSerializer(receipt, context=self.context).data
        return None


class BillingCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Billing
        fields = ['patient', 'appointment', 'amount', 'discount', 'tax', 'description', 'notes', 'due_date']


class PaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    payment_method = serializers.ChoiceField(choices=Billing.PaymentMethod.choices)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Payment amount must be positive.")
        return value
