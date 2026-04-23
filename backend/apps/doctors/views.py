import logging
logger = logging.getLogger(__name__)
from datetime import date
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from core.permissions import IsAdmin, IsAdminOrDoctor
from apps.users.models import User
from .models import Doctor, DoctorSchedule
from .serializers import (
    DoctorSerializer, DoctorUpdateSerializer,
    DoctorListSerializer, DoctorScheduleSerializer
)


class DoctorViewSet(viewsets.ModelViewSet):
    queryset = Doctor.objects.select_related('user', 'department').prefetch_related('schedules').all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['specialization', 'department', 'is_available']
    search_fields = ['user__first_name', 'user__last_name', 'specialization']
    ordering_fields = ['experience_years', 'consultation_fee']

    def get_permissions(self):
        if self.action in [
            'list', 'retrieve',
            'update', 'partial_update',
            'me', 'my_schedule',
            'available_slots', 'dashboard',
        ]:
            return [IsAuthenticated()]
        return [IsAdmin()]

    def get_serializer_class(self):
        if self.action == 'list':
            return DoctorListSerializer
        if self.action in ['update', 'partial_update']:
            return DoctorUpdateSerializer
        return DoctorSerializer

    def update(self, request, *args, **kwargs):
        doctor = self.get_object()
        if request.user.role == User.Role.DOCTOR and doctor.user != request.user:
            return Response({'error': True, 'message': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    @action(detail=False, methods=['get', 'patch'], permission_classes=[IsAuthenticated])
    def me(self, request):
        if request.user.role != User.Role.DOCTOR:
            return Response({'error': True, 'message': 'Not a doctor account.'}, status=status.HTTP_400_BAD_REQUEST)
        doctor, _ = Doctor.objects.get_or_create(
            user=request.user,
            defaults={'specialization': '', 'consultation_fee': 0}
        )
        if request.method == 'GET':
            return Response(DoctorSerializer(doctor, context={'request': request}).data)
        serializer = DoctorUpdateSerializer(doctor, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(DoctorSerializer(doctor, context={'request': request}).data)

    @action(detail=False, methods=['get', 'post', 'put'], permission_classes=[IsAuthenticated])
    def my_schedule(self, request):
        """Doctor o'z jadvalini ko'radi va tahrirlaydi"""
        if request.user.role != User.Role.DOCTOR:
            return Response({'error': True, 'message': 'Not a doctor.'}, status=status.HTTP_403_FORBIDDEN)

        doctor, _ = Doctor.objects.get_or_create(
            user=request.user,
            defaults={'specialization': 'General Medicine', 'consultation_fee': 0}
        )

        if request.method == 'GET':
            schedules = DoctorSchedule.objects.filter(doctor=doctor)
            return Response(DoctorScheduleSerializer(schedules, many=True).data)

        if request.method == 'POST':
            data = request.data if isinstance(request.data, list) else [request.data]
            results = []
            for item in data:
                schedule, created = DoctorSchedule.objects.update_or_create(
                    doctor=doctor,
                    day_of_week=item['day_of_week'],
                    defaults={
                        'start_time': item['start_time'],
                        'end_time': item['end_time'],
                        'is_active': item.get('is_active', True),
                        'slot_duration': item.get('slot_duration', 30),
                    }
                )
                results.append(DoctorScheduleSerializer(schedule).data)
            return Response(results, status=status.HTTP_200_OK)

        if request.method == 'PUT':
            # Butun jadvalni yangilash
            DoctorSchedule.objects.filter(doctor=doctor).delete()
            schedules = []
            for item in request.data:
                s = DoctorSchedule.objects.create(
                    doctor=doctor,
                    day_of_week=item['day_of_week'],
                    start_time=item['start_time'],
                    end_time=item['end_time'],
                    is_active=item.get('is_active', True),
                    slot_duration=item.get('slot_duration', 30),
                )
                schedules.append(s)
            return Response(DoctorScheduleSerializer(schedules, many=True).data)

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def available_slots(self, request, pk=None):
        """Berilgan sana uchun bo'sh time slotlarni qaytaradi"""
        doctor = self.get_object()
        date_str = request.query_params.get('date')
        if not date_str:
            return Response({'error': 'date parametri kerak. Misol: ?date=2026-04-25'}, status=400)

        try:
            selected_date = date.fromisoformat(date_str)
        except ValueError:
            return Response({'error': 'Noto\'g\'ri sana formati. YYYY-MM-DD bo\'lishi kerak'}, status=400)

        day_of_week = selected_date.weekday()  # 0=Monday, 6=Sunday

        try:
            schedule = DoctorSchedule.objects.get(
                doctor=doctor,
                day_of_week=day_of_week,
                is_active=True
            )
        except DoctorSchedule.DoesNotExist:
            return Response({
                'available': False,
                'message': f'Doctor does not work on {selected_date.strftime("%A")}s',
                'slots': []
            })

        # Band bo'lgan slotlarni olish
        from apps.appointments.models import Appointment
        booked_times = Appointment.objects.filter(
            doctor=doctor,
            date=selected_date,
        ).exclude(status='cancelled').values_list('time', flat=True)

        booked_str = [t.strftime('%H:%M') for t in booked_times]
        all_slots = schedule.get_time_slots()
        free_slots = [s for s in all_slots if s not in booked_str]

        return Response({
            'available': True,
            'date': date_str,
            'day': selected_date.strftime('%A'),
            'working_hours': f"{schedule.start_time.strftime('%H:%M')} - {schedule.end_time.strftime('%H:%M')}",
            'total_slots': len(all_slots),
            'booked_slots': booked_str,
            'free_slots': free_slots,
        })

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def dashboard(self, request, pk=None):
        doctor = self.get_object()
        if request.user.role == User.Role.DOCTOR and doctor.user != request.user:
            return Response({'error': True, 'message': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        from apps.appointments.models import Appointment
        today = date.today()
        today_appointments = Appointment.objects.filter(doctor=doctor, date=today)

        return Response({
            'doctor': DoctorSerializer(doctor, context={'request': request}).data,
            'stats': {
                'today_total': today_appointments.count(),
                'today_pending': today_appointments.filter(status=Appointment.Status.PENDING).count(),
                'today_completed': today_appointments.filter(status=Appointment.Status.COMPLETED).count(),
                'today_approved': today_appointments.filter(status=Appointment.Status.APPROVED).count(),
                'total_patients': Appointment.objects.filter(doctor=doctor).values('patient').distinct().count(),
            }
        })