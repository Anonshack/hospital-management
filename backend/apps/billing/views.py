"""
Billing Views
"""

from decimal import Decimal
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Sum, Count, Q

from core.permissions import IsAdmin, IsAdminOrReceptionist
from apps.users.models import User
from .models import Billing
from .serializers import BillingSerializer, BillingCreateSerializer, PaymentSerializer


class BillingViewSet(viewsets.ModelViewSet):
    queryset = Billing.objects.select_related('patient__user', 'appointment').all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'patient', 'payment_method']
    search_fields = ['invoice_number', 'patient__user__first_name', 'patient__user__last_name']
    ordering_fields = ['created_at', 'total_amount', 'due_date']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'my_bills']:
            return [IsAuthenticated()]
        return [IsAdminOrReceptionist()]

    def get_queryset(self):
        user = self.request.user
        if user.role == User.Role.PATIENT:
            return self.queryset.filter(patient__user=user)
        return self.queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return BillingCreateSerializer
        if self.action == 'process_payment':
            return PaymentSerializer
        return BillingSerializer

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrReceptionist])
    def process_payment(self, request, pk=None):
        """POST /api/billing/{id}/process_payment/"""
        bill = self.get_object()
        serializer = PaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payment_amount = Decimal(str(serializer.validated_data['amount']))
        if payment_amount > bill.balance_due:
            return Response(
                {'error': True, 'message': f'Payment exceeds balance due ({bill.balance_due}).'},
                status=status.HTTP_400_BAD_REQUEST
            )

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
        return Response({'message': 'Payment processed.', 'bill': BillingSerializer(bill).data})

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_bills(self, request):
        """GET /api/billing/my_bills/ - Patient's own bills."""
        if request.user.role != User.Role.PATIENT:
            return Response({'error': True, 'message': 'Not a patient account.'}, status=status.HTTP_400_BAD_REQUEST)
        bills = self.queryset.filter(patient__user=request.user)
        return Response(BillingSerializer(bills, many=True).data)

    @action(detail=False, methods=['get'], permission_classes=[IsAdmin])
    def revenue_summary(self, request):
        """GET /api/billing/revenue_summary/ - Admin financial dashboard."""
        from datetime import date, timedelta
        today = date.today()
        month_start = today.replace(day=1)

        paid_qs = self.queryset.filter(status=Billing.Status.PAID)
        return Response({
            'total_revenue': paid_qs.aggregate(total=Sum('total_amount'))['total'] or 0,
            'monthly_revenue': paid_qs.filter(payment_date__date__gte=month_start).aggregate(total=Sum('total_amount'))['total'] or 0,
            'today_revenue': paid_qs.filter(payment_date__date=today).aggregate(total=Sum('total_amount'))['total'] or 0,
            'unpaid_total': self.queryset.filter(status=Billing.Status.UNPAID).aggregate(total=Sum('total_amount'))['total'] or 0,
            'by_status': {
                item['status']: {'count': item['count'], 'total': float(item['total'] or 0)}
                for item in self.queryset.values('status').annotate(count=Count('id'), total=Sum('total_amount'))
            }
        })
