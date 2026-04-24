from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import transaction

from core.permissions import IsAdmin, IsAdminOrDoctor, IsAdminOrDoctorOrNurse
from apps.users.models import User
from .models import Patient
from .serializers import PatientSerializer, PatientUpdateSerializer, PatientListSerializer


class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.select_related('user').all().order_by('-created_at')
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['blood_group']
    search_fields = ['user__first_name', 'user__last_name', 'user__email', 'insurance_number']
    ordering_fields = ['created_at', 'user__first_name']

    def get_permissions(self):
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
        user = request.user
        if user.role == User.Role.ADMIN:
            pass  # Admin can update any patient
        elif user.role == User.Role.PATIENT and patient.user != user:
            return Response({'error': True, 'message': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        elif user.role not in [User.Role.ADMIN, User.Role.PATIENT]:
            return Response({'error': True, 'message': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if request.user.role != User.Role.ADMIN:
            return Response({'error': 'Only admin can delete patients.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    def list(self, request, *args, **kwargs):
        user = request.user
        if user.role not in [User.Role.ADMIN, User.Role.DOCTOR, User.Role.NURSE, User.Role.RECEPTIONIST]:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=['get', 'patch'], permission_classes=[IsAuthenticated],
            parser_classes=[MultiPartParser, FormParser, JSONParser])
    def me(self, request):
        """GET/PATCH /api/patients/me/ — current patient's own profile."""
        if request.user.role != User.Role.PATIENT:
            return Response({'error': True, 'message': 'Not a patient account.'}, status=status.HTTP_400_BAD_REQUEST)

        patient, _ = Patient.objects.get_or_create(user=request.user)

        if request.method == 'GET':
            return Response(PatientSerializer(patient, context={'request': request}).data)

        with transaction.atomic():
            # Update User fields (avatar, phone, first_name, last_name)
            user_fields = {}
            if 'avatar' in request.FILES:
                user_fields['avatar'] = request.FILES['avatar']
            for field in ('first_name', 'last_name', 'phone'):
                if field in request.data:
                    user_fields[field] = request.data[field]
            if user_fields:
                for attr, val in user_fields.items():
                    setattr(request.user, attr, val)
                request.user.save(update_fields=list(user_fields.keys()))

            # Update Patient fields
            patient_data = {}
            patient_writable = [
                'blood_group', 'date_of_birth', 'address',
                'emergency_contact_name', 'emergency_contact_phone',
                'allergies', 'chronic_conditions', 'insurance_number',
            ]
            for field in patient_writable:
                if field in request.data:
                    patient_data[field] = request.data[field]

            if patient_data:
                serializer = PatientUpdateSerializer(patient, data=patient_data, partial=True)
                serializer.is_valid(raise_exception=True)
                serializer.save()

        patient.refresh_from_db()
        return Response(PatientSerializer(patient, context={'request': request}).data)

    @action(detail=True, methods=['get'], permission_classes=[IsAdminOrDoctor])
    def medical_records(self, request, pk=None):
        patient = self.get_object()
        from apps.medical_records.models import MedicalRecord
        from apps.medical_records.serializers import MedicalRecordSerializer
        records = MedicalRecord.objects.filter(patient=patient).order_by('-created_at')
        return Response(MedicalRecordSerializer(records, many=True, context={'request': request}).data)

    @action(detail=True, methods=['get'], permission_classes=[IsAdminOrDoctor])
    def appointments(self, request, pk=None):
        patient = self.get_object()
        from apps.appointments.models import Appointment
        from apps.appointments.serializers import AppointmentSerializer
        appts = Appointment.objects.filter(patient=patient).order_by('-date', '-time')
        return Response(AppointmentSerializer(appts, many=True, context={'request': request}).data)
