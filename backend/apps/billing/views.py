from decimal import Decimal
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Sum, Count

from core.permissions import IsAdmin
from apps.users.models import User
from apps.patients.models import Patient
from .models import Billing, PaymentReceipt
from .serializers import BillingSerializer, BillingCreateSerializer, PaymentSerializer, PaymentReceiptSerializer


class BillingViewSet(viewsets.ModelViewSet):
    queryset = Billing.objects.select_related('patient__user', 'appointment').prefetch_related('receipts').all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'patient', 'payment_method']
    search_fields = ['invoice_number', 'patient__user__first_name', 'patient__user__last_name']
    ordering_fields = ['created_at', 'total_amount', 'due_date']
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.role == User.Role.PATIENT:
            return self.queryset.filter(patient__user=user)
        if user.role == User.Role.DOCTOR:
            # Doctor sees bills for their appointments
            return self.queryset.filter(appointment__doctor__user=user)
        return self.queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return BillingCreateSerializer
        if self.action == 'process_payment':
            return PaymentSerializer
        return BillingSerializer

    def create(self, request, *args, **kwargs):
        if request.user.role not in [User.Role.ADMIN, User.Role.RECEPTIONIST]:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if request.user.role not in [User.Role.ADMIN, User.Role.RECEPTIONIST]:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if request.user.role != User.Role.ADMIN:
            return Response({'error': 'Only admin can delete billing records.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def process_payment(self, request, pk=None):
        if request.user.role not in [User.Role.ADMIN, User.Role.RECEPTIONIST]:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        bill = self.get_object()
        serializer = PaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payment_amount = Decimal(str(serializer.validated_data['amount']))
        if payment_amount > bill.balance_due:
            return Response({'error': True, 'message': f'Payment exceeds balance due ({bill.balance_due}).'}, status=status.HTTP_400_BAD_REQUEST)

        bill.paid_amount += payment_amount
        bill.payment_method = serializer.validated_data['payment_method']
        bill.payment_date = timezone.now()
        if bill.paid_amount >= bill.total_amount:
            bill.status = Billing.Status.PAID
        elif bill.paid_amount > 0:
            bill.status = Billing.Status.PARTIALLY_PAID
        if serializer.validated_data.get('notes'):
            bill.notes = (bill.notes + '\n' + serializer.validated_data['notes']).strip()
        bill.save()
        return Response({'message': 'Payment processed.', 'bill': BillingSerializer(bill, context={'request': request}).data})

    @action(detail=True, methods=['post'], url_path='upload-receipt', parser_classes=[MultiPartParser, FormParser])
    def upload_receipt(self, request, pk=None):
        """Patient uploads card payment screenshot."""
        bill = self.get_object()
        user = request.user

        if user.role != User.Role.PATIENT:
            return Response({'error': 'Only patients can upload receipts.'}, status=status.HTTP_403_FORBIDDEN)
        if bill.patient.user != user:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        receipt_image = request.FILES.get('receipt_image')
        if not receipt_image:
            return Response({'error': 'receipt_image is required.'}, status=status.HTTP_400_BAD_REQUEST)

        amount = request.data.get('amount', bill.balance_due)
        card_number = request.data.get('card_number', '')
        note = request.data.get('note', '')

        try:
            patient = Patient.objects.get(user=user)
        except Patient.DoesNotExist:
            return Response({'error': 'Patient profile not found.'}, status=status.HTTP_400_BAD_REQUEST)

        receipt = PaymentReceipt.objects.create(
            billing=bill,
            patient=patient,
            card_number=card_number,
            amount=amount,
            receipt_image=receipt_image,
            note=note,
        )
        return Response(PaymentReceiptSerializer(receipt, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='pending-receipts')
    def pending_receipts(self, request):
        """Admin sees all pending receipts."""
        if request.user.role != User.Role.ADMIN:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        receipts = PaymentReceipt.objects.select_related('billing', 'patient__user').filter(status='pending').order_by('-created_at')
        return Response(PaymentReceiptSerializer(receipts, many=True, context={'request': request}).data)

    @action(detail=False, methods=['post'], url_path='confirm-receipt')
    def confirm_receipt(self, request):
        """Admin confirms or rejects a receipt."""
        if request.user.role != User.Role.ADMIN:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        receipt_id = request.data.get('receipt_id')
        action_type = request.data.get('action')  # 'confirm' or 'reject'

        if action_type not in ['confirm', 'reject']:
            return Response({'error': 'action must be confirm or reject.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            receipt = PaymentReceipt.objects.select_related('billing').get(id=receipt_id)
        except PaymentReceipt.DoesNotExist:
            return Response({'error': 'Receipt not found.'}, status=status.HTTP_404_NOT_FOUND)

        if action_type == 'confirm':
            receipt.status = PaymentReceipt.Status.CONFIRMED
            receipt.confirmed_by = request.user
            receipt.confirmed_at = timezone.now()
            receipt.save()

            # Update billing
            bill = receipt.billing
            bill.paid_amount += Decimal(str(receipt.amount))
            bill.payment_method = Billing.PaymentMethod.CARD
            bill.payment_date = timezone.now()
            if bill.paid_amount >= bill.total_amount:
                bill.status = Billing.Status.PAID
            elif bill.paid_amount > 0:
                bill.status = Billing.Status.PARTIALLY_PAID
            bill.save()
        else:
            receipt.status = PaymentReceipt.Status.REJECTED
            receipt.confirmed_by = request.user
            receipt.confirmed_at = timezone.now()
            receipt.save()

        return Response(PaymentReceiptSerializer(receipt, context={'request': request}).data)

    @action(detail=False, methods=['get'])
    def my_bills(self, request):
        if request.user.role != User.Role.PATIENT:
            return Response({'error': 'Not a patient account.'}, status=status.HTTP_400_BAD_REQUEST)
        bills = self.queryset.filter(patient__user=request.user)
        return Response(BillingSerializer(bills, many=True, context={'request': request}).data)

    @action(detail=False, methods=['get'], permission_classes=[IsAdmin])
    def revenue_summary(self, request):
        from datetime import date
        today = date.today()
        month_start = today.replace(day=1)
        paid_qs = self.queryset.filter(status=Billing.Status.PAID)
        return Response({
            'total_revenue': paid_qs.aggregate(total=Sum('total_amount'))['total'] or 0,
            'monthly_revenue': paid_qs.filter(payment_date__date__gte=month_start).aggregate(total=Sum('total_amount'))['total'] or 0,
            'today_revenue': paid_qs.filter(payment_date__date=today).aggregate(total=Sum('total_amount'))['total'] or 0,
            'unpaid_total': self.queryset.filter(status=Billing.Status.UNPAID).aggregate(total=Sum('total_amount'))['total'] or 0,
            'pending_receipts': PaymentReceipt.objects.filter(status='pending').count(),
        })
