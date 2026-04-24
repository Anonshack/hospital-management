import logging
logger = logging.getLogger(__name__)
from datetime import date
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import transaction

from core.permissions import IsAdmin, IsAdminOrDoctor
from apps.users.models import User
from .models import Doctor, DoctorSchedule
from .serializers import (
    DoctorSerializer, DoctorUpdateSerializer,
    DoctorListSerializer, DoctorScheduleSerializer
)


class DoctorViewSet(viewsets.ModelViewSet):
    queryset = Doctor.objects.select_related('user', 'department').prefetch_related('schedules').all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]
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

    @action(detail=False, methods=['get', 'patch'], permission_classes=[IsAuthenticated],
            parser_classes=[MultiPartParser, FormParser, JSONParser])
    def me(self, request):
        if request.user.role != User.Role.DOCTOR:
            return Response({'error': True, 'message': 'Not a doctor account.'}, status=status.HTTP_400_BAD_REQUEST)

        doctor, _ = Doctor.objects.get_or_create(
            user=request.user,
            defaults={'specialization': '', 'consultation_fee': 0}
        )

        if request.method == 'GET':
            return Response(DoctorSerializer(doctor, context={'request': request}).data)

        # PATCH — update doctor fields + optionally user avatar/name
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

            # Update Doctor fields
            doctor_data = {}
            doctor_writable = [
                'department', 'specialization', 'qualification',
                'experience_years', 'consultation_fee', 'bio',
                'is_available', 'license_number',
            ]
            for field in doctor_writable:
                if field in request.data:
                    doctor_data[field] = request.data[field]

            if doctor_data:
                serializer = DoctorUpdateSerializer(doctor, data=doctor_data, partial=True)
                serializer.is_valid(raise_exception=True)
                serializer.save()

        doctor.refresh_from_db()
        return Response(DoctorSerializer(doctor, context={'request': request}).data)

    @action(detail=False, methods=['get', 'post', 'delete'], permission_classes=[IsAuthenticated])
    def my_schedule(self, request):
        """Doctor o'z jadvalini ko'radi, saqlaydi va o'chiradi."""
        if request.user.role != User.Role.DOCTOR:
            return Response({'error': True, 'message': 'Not a doctor.'}, status=status.HTTP_403_FORBIDDEN)

        doctor, _ = Doctor.objects.get_or_create(
            user=request.user,
            defaults={'specialization': 'General Medicine', 'consultation_fee': 0}
        )

        if request.method == 'GET':
            schedules = DoctorSchedule.objects.filter(doctor=doctor).order_by('day_of_week')
            return Response(DoctorScheduleSerializer(schedules, many=True).data)

        if request.method == 'DELETE':
            day_of_week = request.query_params.get('day')
            if day_of_week is not None:
                DoctorSchedule.objects.filter(doctor=doctor, day_of_week=day_of_week).delete()
            else:
                DoctorSchedule.objects.filter(doctor=doctor).delete()
            return Response({'message': 'Schedule deleted.'}, status=status.HTTP_204_NO_CONTENT)

        if request.method == 'POST':
            raw = request.data
            items = raw if isinstance(raw, list) else [raw]

            if not items:
                return Response({'error': True, 'message': 'No schedule data provided.'}, status=status.HTTP_400_BAD_REQUEST)

            errors = []
            results = []

            try:
                with transaction.atomic():
                    for idx, item in enumerate(items):
                        # Validate required fields
                        day = item.get('day_of_week')
                        start = item.get('start_time')
                        end = item.get('end_time')

                        if day is None:
                            errors.append({'index': idx, 'field': 'day_of_week', 'message': 'Required.'})
                            continue
                        if not start:
                            errors.append({'index': idx, 'field': 'start_time', 'message': 'Required.'})
                            continue
                        if not end:
                            errors.append({'index': idx, 'field': 'end_time', 'message': 'Required.'})
                            continue

                        # Normalize time strings (accept HH:MM or HH:MM:SS)
                        if isinstance(start, str) and len(start) == 5:
                            start = start + ':00'
                        if isinstance(end, str) and len(end) == 5:
                            end = end + ':00'

                        slot_duration = int(item.get('slot_duration', 30))
                        if slot_duration <= 0:
                            slot_duration = 30
                        is_active = item.get('is_active', True)
                        if isinstance(is_active, str):
                            is_active = is_active.lower() not in ('false', '0', 'no')

                        schedule_obj, created = DoctorSchedule.objects.update_or_create(
                            doctor=doctor,
                            day_of_week=int(day),
                            defaults={
                                'start_time': start,
                                'end_time': end,
                                'is_active': is_active,
                                'slot_duration': slot_duration,
                            }
                        )
                        results.append(schedule_obj)

                    if errors:
                        raise ValueError("Validation errors occurred")

            except ValueError as e:
                return Response({
                    'error': True,
                    'message': 'Validation errors in schedule data.',
                    'details': errors,
                }, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                logger.exception(f"Error saving schedule for doctor {doctor.id}: {e}")
                return Response({
                    'error': True,
                    'message': f'Failed to save schedule: {str(e)}',
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # Serialize results AFTER the transaction is committed
            serialized = []
            for obj in results:
                try:
                    serialized.append(DoctorScheduleSerializer(obj).data)
                except Exception as ser_err:
                    logger.warning(f"Serialization warning for schedule {obj.id}: {ser_err}")
                    # Return minimal safe data if serializer fails
                    serialized.append({
                        'id': obj.id,
                        'day_of_week': obj.day_of_week,
                        'start_time': str(obj.start_time),
                        'end_time': str(obj.end_time),
                        'is_active': obj.is_active,
                        'slot_duration': obj.slot_duration,
                        'time_slots': [],
                    })

            return Response(serialized, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def available_slots(self, request, pk=None):
        """Berilgan sana uchun bo'sh time slotlarni qaytaradi."""
        doctor = self.get_object()
        date_str = request.query_params.get('date')
        if not date_str:
            return Response({'error': 'date parametri kerak. Misol: ?date=2026-04-25'}, status=400)

        try:
            selected_date = date.fromisoformat(date_str)
        except ValueError:
            return Response({'error': "Noto'g'ri sana formati. YYYY-MM-DD bo'lishi kerak"}, status=400)

        day_of_week = selected_date.weekday()

        try:
            schedule = DoctorSchedule.objects.get(
                doctor=doctor,
                day_of_week=day_of_week,
                is_active=True,
            )
        except DoctorSchedule.DoesNotExist:
            return Response({
                'available': False,
                'message': f"Doctor does not work on {selected_date.strftime('%A')}s",
                'slots': [],
                'free_slots': [],
                'booked_slots': [],
            })

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
