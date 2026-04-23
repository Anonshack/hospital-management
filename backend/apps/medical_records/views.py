"""
Medical Records Views
"""

from rest_framework import viewsets, parsers
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from core.permissions import IsAdmin, IsAdminOrDoctor
from apps.users.models import User
from .models import MedicalRecord
from .serializers import MedicalRecordSerializer, MedicalRecordCreateSerializer


class MedicalRecordViewSet(viewsets.ModelViewSet):
    queryset = MedicalRecord.objects.select_related('patient__user', 'doctor__user').prefetch_related('prescriptions').all()
    parser_classes = [parsers.MultiPartParser, parsers.JSONParser, parsers.FormParser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['patient', 'doctor', 'follow_up_date']
    search_fields = ['diagnosis', 'patient__user__first_name', 'patient__user__last_name']
    ordering_fields = ['created_at']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrDoctor()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = self.queryset
        if user.role == User.Role.PATIENT:
            return qs.filter(patient__user=user, is_confidential=False)
        if user.role == User.Role.DOCTOR:
            return qs.filter(doctor__user=user)
        if user.role == User.Role.NURSE:
            return qs.filter(is_confidential=False)
        return qs

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return MedicalRecordCreateSerializer
        return MedicalRecordSerializer
