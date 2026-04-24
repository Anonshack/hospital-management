"""
Appointment Views - Full booking and management system
"""

from datetime import date, timedelta
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
import django_filters

from core.permissions import IsAdmin, IsAdminOrDoctor, IsAdminOrReceptionist
from apps.users.models import User
from apps.patients.models import Patient
from .models import Appointment, AppointmentImage
from .serializers import (
    AppointmentSerializer,
    AppointmentCreateSerializer,
    AppointmentStatusUpdateSerializer,
    AppointmentListSerializer,
    AppointmentImageSerializer,
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
    queryset = Appointment.objects.select_related(
        'patient__user', 'doctor__user', 'cancelled_by'
    ).prefetch_related('images').all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = AppointmentFilter
    search_fields = ['patient__user__first_name', 'patient__user__last_name',
                     'doctor__user__first_name', 'reason']
    ordering_fields = ['date', 'time', 'status', 'created_at']
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = self.queryset
        if user.role == User.Role.ADMIN:
            return qs
        if user.role == User.Role.DOCTOR:
            return qs.filter(doctor__user=user)
        if user.role == User.Role.PATIENT:
            return qs.filter(patient__user=user)
        if user.role == User.Role.NURSE:
            return qs.filter(status__in=[Appointment.Status.APPROVED, Appointment.Status.COMPLETED])
        return qs  # Receptionist sees all

    def get_serializer_class(self):
        if self.action == 'create':
            return AppointmentCreateSerializer
        if self.action in ['update', 'partial_update']:
            return AppointmentStatusUpdateSerializer
        if self.action == 'list':
            return AppointmentListSerializer
        return AppointmentSerializer

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == User.Role.PATIENT:
            patient, _ = Patient.objects.get_or_create(user=user)
            appointment = serializer.save(patient=patient)
        else:
            if 'patient' not in serializer.validated_data:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'patient': 'Patient is required.'})
            appointment = serializer.save()

        # Auto-create billing record for the appointment
        try:
            from apps.billing.models import Billing
            fee = appointment.doctor.consultation_fee or 0
            Billing.objects.get_or_create(
                appointment=appointment,
                defaults={
                    'patient': appointment.patient,
                    'amount': fee,
                    'description': f"Consultation with {appointment.doctor.full_name}",
                }
            )
        except Exception:
            pass

        try:
            NotificationService.send_appointment_confirmation(appointment)
        except Exception:
            pass

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        appointment = serializer.instance
        # Get the auto-created bill id
        bill_id = None
        try:
            bill_id = appointment.bill.id
        except Exception:
            pass
        data = AppointmentSerializer(appointment, context={'request': request}).data
        data['bill_id'] = bill_id
        return Response(data, status=status.HTTP_201_CREATED)
        appointment = self.get_object()
        user = request.user
        # Admin can delete any; doctor can delete their own; patient can delete their own
        if user.role == User.Role.ADMIN:
            pass
        elif user.role == User.Role.DOCTOR and appointment.doctor.user == user:
            pass
        elif user.role == User.Role.PATIENT and appointment.patient.user == user:
            pass
        else:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        appointment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_update(self, serializer):
        appointment = serializer.save()
        try:
            if 'status' in serializer.validated_data:
                NotificationService.send_appointment_status_update(appointment)
        except Exception:
            pass

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        appointment = self.get_object()
        user = request.user

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

        appointment.status = Appointment.Status.CANCELLED
        appointment.cancellation_reason = request.data.get('reason', '')
        appointment.cancelled_by = user
        appointment.save()

        try:
            NotificationService.send_appointment_status_update(appointment)
        except Exception:
            pass

        return Response({'message': 'Appointment cancelled successfully.'})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        appointment = self.get_object()
        user = request.user

        if user.role not in [User.Role.ADMIN, User.Role.DOCTOR]:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        if user.role == User.Role.DOCTOR and appointment.doctor.user != user:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

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
        return Response({'message': 'Appointment approved.',
                         'appointment': AppointmentSerializer(appointment, context={'request': request}).data})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Doctor/Admin can reject (cancel) a pending appointment."""
        appointment = self.get_object()
        user = request.user

        if user.role not in [User.Role.ADMIN, User.Role.DOCTOR]:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        if user.role == User.Role.DOCTOR and appointment.doctor.user != user:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        if appointment.status not in [Appointment.Status.PENDING, Appointment.Status.APPROVED]:
            return Response({'error': 'Cannot reject this appointment.'}, status=status.HTTP_400_BAD_REQUEST)

        appointment.status = Appointment.Status.CANCELLED
        appointment.cancellation_reason = request.data.get('reason', 'Rejected by doctor.')
        appointment.cancelled_by = user
        appointment.save()
        try:
            NotificationService.send_appointment_status_update(appointment)
        except Exception:
            pass
        return Response({'message': 'Appointment rejected.'})

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        appointment = self.get_object()
        user = request.user

        if user.role not in [User.Role.ADMIN, User.Role.DOCTOR]:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        if user.role == User.Role.DOCTOR and appointment.doctor.user != user:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        if appointment.status != Appointment.Status.APPROVED:
            return Response(
                {'error': True, 'message': 'Only approved appointments can be completed.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        appointment.status = Appointment.Status.COMPLETED
        appointment.notes = request.data.get('notes', appointment.notes)
        appointment.save()
        return Response({'message': 'Appointment marked as completed.',
                         'appointment': AppointmentSerializer(appointment, context={'request': request}).data})

    @action(detail=True, methods=['post'], url_path='upload-images')
    def upload_images(self, request, pk=None):
        """POST /api/appointments/{id}/upload-images/ — add images to existing appointment."""
        appointment = self.get_object()
        user = request.user

        is_owner = (
            (user.role == User.Role.PATIENT and appointment.patient.user == user) or
            user.role in [User.Role.ADMIN, User.Role.DOCTOR, User.Role.RECEPTIONIST]
        )
        if not is_owner:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        existing_count = appointment.images.count()
        files = request.FILES.getlist('images')
        if not files:
            return Response({'error': 'No images provided.'}, status=status.HTTP_400_BAD_REQUEST)
        if existing_count + len(files) > 4:
            return Response(
                {'error': f'Maximum 4 images allowed. Already have {existing_count}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        created = []
        for f in files:
            img = AppointmentImage.objects.create(appointment=appointment, image=f)
            created.append(AppointmentImageSerializer(img, context={'request': request}).data)

        return Response({'images': created}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def today(self, request):
        qs = self.get_queryset().filter(date=date.today())
        serializer = AppointmentListSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        qs = self.get_queryset().filter(
            date__gte=date.today(),
            status__in=[Appointment.Status.PENDING, Appointment.Status.APPROVED]
        ).order_by('date', 'time')[:10]
        serializer = AppointmentListSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAdmin])
    def statistics(self, request):
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
