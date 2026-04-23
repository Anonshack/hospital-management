"""
Appointment Views - Full booking and management system
"""

from datetime import date, timedelta
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
import django_filters

from core.permissions import IsAdmin, IsAdminOrDoctor, IsAdminOrReceptionist
from apps.users.models import User
from apps.patients.models import Patient
from .models import Appointment
from .serializers import (
    AppointmentSerializer,
    AppointmentCreateSerializer,
    AppointmentStatusUpdateSerializer,
    AppointmentListSerializer,
)
from apps.notifications.services import NotificationService


class AppointmentFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name='date', lookup_expr='gte')
    date_to = django_filters.DateFilter(field_name='date', lookup_expr='lte')
    date = django_filters.DateFilter(field_name='date')

    class Meta:
        model = Appointment
        fields = ['status', 'doctor', 'patient', 'date', 'date_from', 'date_to', 'is_follow_up']


class AppointmentViewSet(viewsets.ModelViewSet):
    """
    Full CRUD for Appointments with role-based filtering.
    - Admin/Receptionist: all appointments
    - Doctor: their own appointments
    - Patient: their own appointments
    """
    queryset = Appointment.objects.select_related(
        'patient__user', 'doctor__user', 'cancelled_by'
    ).all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = AppointmentFilter
    search_fields = ['patient__user__first_name', 'patient__user__last_name', 'doctor__user__first_name', 'reason']
    ordering_fields = ['date', 'time', 'status', 'created_at']

    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            return [IsAuthenticated()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = self.queryset
        if user.role == User.Role.DOCTOR:
            return qs.filter(doctor__user=user)
        if user.role == User.Role.PATIENT:
            return qs.filter(patient__user=user)
        if user.role == User.Role.NURSE:
            return qs.filter(status__in=[Appointment.Status.APPROVED, Appointment.Status.COMPLETED])
        return qs  # Admin, Receptionist see all

    def get_serializer_class(self):
        if self.action == 'create':
            return AppointmentCreateSerializer
        if self.action in ['update', 'partial_update']:
            return AppointmentStatusUpdateSerializer
        if self.action == 'list':
            return AppointmentListSerializer
        return AppointmentSerializer

    def perform_create(self, serializer):
        """Auto-assign patient profile for patient users."""
        user = self.request.user
        if user.role == User.Role.PATIENT:
            patient = Patient.objects.get(user=user)
            appointment = serializer.save(patient=patient)
        else:
            appointment = serializer.save()

        # Send notification
        try:
            NotificationService.send_appointment_confirmation(appointment)
        except Exception:
            pass

    def perform_update(self, serializer):
        appointment = serializer.save()
        # Notify on status change
        try:
            if 'status' in serializer.validated_data:
                NotificationService.send_appointment_status_update(appointment)
        except Exception:
            pass

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def cancel(self, request, pk=None):
        """POST /api/appointments/{id}/cancel/"""
        appointment = self.get_object()
        user = request.user

        # Permission check
        is_owner = (
            (user.role == User.Role.PATIENT and appointment.patient.user == user) or
            (user.role == User.Role.DOCTOR and appointment.doctor.user == user) or
            user.role in [User.Role.ADMIN, User.Role.RECEPTIONIST]
        )
        if not is_owner:
            return Response({'error': True, 'message': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        if appointment.status in [Appointment.Status.COMPLETED, Appointment.Status.CANCELLED]:
            return Response(
                {'error': True, 'message': f'Cannot cancel a {appointment.status} appointment.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        reason = request.data.get('reason', '')
        appointment.status = Appointment.Status.CANCELLED
        appointment.cancellation_reason = reason
        appointment.cancelled_by = user
        appointment.save()

        try:
            NotificationService.send_appointment_status_update(appointment)
        except Exception:
            pass

        return Response({'message': 'Appointment cancelled successfully.'})

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrDoctor])
    def approve(self, request, pk=None):
        """POST /api/appointments/{id}/approve/"""
        appointment = self.get_object()
        if appointment.status != Appointment.Status.PENDING:
            return Response(
                {'error': True, 'message': 'Only pending appointments can be approved.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        appointment.status = Appointment.Status.APPROVED
        appointment.notes = request.data.get('notes', appointment.notes)
        appointment.save()
        try:
            NotificationService.send_appointment_status_update(appointment)
        except Exception:
            pass
        return Response({'message': 'Appointment approved.', 'appointment': AppointmentSerializer(appointment).data})

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrDoctor])
    def complete(self, request, pk=None):
        """POST /api/appointments/{id}/complete/"""
        appointment = self.get_object()
        if appointment.status != Appointment.Status.APPROVED:
            return Response(
                {'error': True, 'message': 'Only approved appointments can be completed.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        appointment.status = Appointment.Status.COMPLETED
        appointment.notes = request.data.get('notes', appointment.notes)
        appointment.save()
        return Response({'message': 'Appointment marked as completed.', 'appointment': AppointmentSerializer(appointment).data})

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def today(self, request):
        """GET /api/appointments/today/ - Today's appointments."""
        qs = self.get_queryset().filter(date=date.today())
        serializer = AppointmentListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def upcoming(self, request):
        """GET /api/appointments/upcoming/ - Upcoming appointments."""
        qs = self.get_queryset().filter(
            date__gte=date.today(),
            status__in=[Appointment.Status.PENDING, Appointment.Status.APPROVED]
        ).order_by('date', 'time')[:10]
        serializer = AppointmentListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAdmin])
    def statistics(self, request):
        """GET /api/appointments/statistics/ - Admin dashboard stats."""
        from django.db.models import Count
        today = date.today()
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)

        return Response({
            'total': Appointment.objects.count(),
            'today': Appointment.objects.filter(date=today).count(),
            'this_week': Appointment.objects.filter(date__gte=week_ago).count(),
            'this_month': Appointment.objects.filter(date__gte=month_ago).count(),
            'by_status': {
                item['status']: item['count']
                for item in Appointment.objects.values('status').annotate(count=Count('id'))
            }
        })
