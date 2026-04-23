"""
Admin Dashboard - Aggregate statistics across all apps
"""
from datetime import date, timedelta
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum, Count, Q
from core.permissions import IsAdmin
from apps.users.models import User
from apps.patients.models import Patient
from apps.doctors.models import Doctor
from apps.appointments.models import Appointment
from apps.billing.models import Billing


class AdminDashboardView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        today = date.today()
        month_start = today.replace(day=1)
        week_ago = today - timedelta(days=7)

        # Users
        total_patients = Patient.objects.count()
        total_doctors = Doctor.objects.filter(user__is_active=True).count()
        total_staff = User.objects.exclude(role=User.Role.PATIENT).count()

        # Appointments
        appt_qs = Appointment.objects
        today_appointments = appt_qs.filter(date=today).count()
        pending_appointments = appt_qs.filter(status=Appointment.Status.PENDING).count()
        monthly_appointments = appt_qs.filter(date__gte=month_start).count()

        # Revenue
        paid_bills = Billing.objects.filter(status=Billing.Status.PAID)
        total_revenue = paid_bills.aggregate(t=Sum('total_amount'))['t'] or 0
        monthly_revenue = paid_bills.filter(payment_date__date__gte=month_start).aggregate(t=Sum('total_amount'))['t'] or 0
        today_revenue = paid_bills.filter(payment_date__date=today).aggregate(t=Sum('total_amount'))['t'] or 0
        unpaid_amount = Billing.objects.filter(status=Billing.Status.UNPAID).aggregate(t=Sum('total_amount'))['t'] or 0

        # Recent appointments
        recent_appts = Appointment.objects.select_related(
            'patient__user', 'doctor__user'
        ).order_by('-created_at')[:5]

        return Response({
            'overview': {
                'total_patients': total_patients,
                'total_doctors': total_doctors,
                'total_staff': total_staff,
                'today_appointments': today_appointments,
                'pending_appointments': pending_appointments,
                'monthly_appointments': monthly_appointments,
            },
            'revenue': {
                'total': float(total_revenue),
                'monthly': float(monthly_revenue),
                'today': float(today_revenue),
                'unpaid': float(unpaid_amount),
            },
            'appointment_status_breakdown': {
                item['status']: item['count']
                for item in Appointment.objects.values('status').annotate(count=Count('id'))
            },
            'recent_appointments': [
                {
                    'id': a.id,
                    'patient': a.patient.full_name,
                    'doctor': a.doctor.full_name,
                    'date': a.date,
                    'time': str(a.time),
                    'status': a.status,
                }
                for a in recent_appts
            ],
        })
