"""
Patient Views
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from core.permissions import IsAdmin, IsAdminOrDoctor, IsAdminOrDoctorOrNurse, IsOwnerOrAdmin
from apps.users.models import User
from .models import Patient
from .serializers import PatientSerializer, PatientUpdateSerializer, PatientListSerializer


class PatientViewSet(viewsets.ModelViewSet):
    """
    Full CRUD for Patients.
    - Admin: full access
    - Doctor/Nurse: read-only
    - Patient: own profile only
    """
    queryset = Patient.objects.select_related('user').all().order_by('-created_at')
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['blood_group']
    search_fields = ['user__first_name', 'user__last_name', 'user__email', 'insurance_number']
    ordering_fields = ['created_at', 'user__first_name']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAdminOrDoctorOrNurse()]
        if self.action in ['update', 'partial_update']:
            return [IsAuthenticated()]
        if self.action == 'destroy':
            return [IsAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.role == User.Role.PATIENT:
            return Patient.objects.filter(user=user)
        return self.queryset

    def get_serializer_class(self):
        if self.action == 'list':
            return PatientListSerializer
        if self.action in ['update', 'partial_update']:
            return PatientUpdateSerializer
        return PatientSerializer

    def update(self, request, *args, **kwargs):
        patient = self.get_object()
        # Patients can only update their own profile
        if request.user.role == User.Role.PATIENT and patient.user != request.user:
            return Response({'error': True, 'message': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    @action(detail=False, methods=['get', 'patch'], permission_classes=[IsAuthenticated])
    def me(self, request):
        """GET/PATCH /api/patients/me/ - Current patient's own profile."""
        if request.user.role != User.Role.PATIENT:
            return Response({'error': True, 'message': 'Not a patient account.'}, status=status.HTTP_400_BAD_REQUEST)
        patient, _ = Patient.objects.get_or_create(user=request.user)
        if request.method == 'GET':
            return Response(PatientSerializer(patient, context={'request': request}).data)
        serializer = PatientUpdateSerializer(patient, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(PatientSerializer(patient, context={'request': request}).data)

    @action(detail=True, methods=['get'], permission_classes=[IsAdminOrDoctor])
    def medical_records(self, request, pk=None):
        """GET /api/patients/{id}/medical_records/"""
        patient = self.get_object()
        from apps.medical_records.models import MedicalRecord
        from apps.medical_records.serializers import MedicalRecordSerializer
        records = MedicalRecord.objects.filter(patient=patient).order_by('-created_at')
        serializer = MedicalRecordSerializer(records, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get'], permission_classes=[IsAdminOrDoctor])
    def appointments(self, request, pk=None):
        """GET /api/patients/{id}/appointments/"""
        patient = self.get_object()
        from apps.appointments.models import Appointment
        from apps.appointments.serializers import AppointmentSerializer
        appts = Appointment.objects.filter(patient=patient).order_by('-date', '-time')
        serializer = AppointmentSerializer(appts, many=True, context={'request': request})
        return Response(serializer.data)
