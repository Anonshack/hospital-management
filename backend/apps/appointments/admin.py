from django.contrib import admin
from .models import Appointment


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ['id', 'patient', 'doctor', 'date', 'time', 'status', 'created_at']
    list_filter = ['status', 'date', 'is_follow_up']
    search_fields = [
        'patient__user__first_name', 'patient__user__last_name',
        'doctor__user__first_name', 'doctor__user__last_name',
        'reason',
    ]
    ordering = ['-date', '-time']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['patient', 'doctor', 'cancelled_by', 'follow_up_for']
    date_hierarchy = 'date'

    fieldsets = (
        ('Appointment', {'fields': ('patient', 'doctor', 'date', 'time', 'status')}),
        ('Details', {'fields': ('reason', 'symptoms', 'notes', 'is_follow_up', 'follow_up_for')}),
        ('Cancellation', {'fields': ('cancelled_by', 'cancellation_reason')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    )

    actions = ['approve_appointments', 'cancel_appointments']

    def approve_appointments(self, request, queryset):
        updated = queryset.filter(status='pending').update(status='approved')
        self.message_user(request, f'{updated} appointments approved.')
    approve_appointments.short_description = 'Approve selected appointments'

    def cancel_appointments(self, request, queryset):
        updated = queryset.exclude(status__in=['completed', 'cancelled']).update(status='cancelled')
        self.message_user(request, f'{updated} appointments cancelled.')
    cancel_appointments.short_description = 'Cancel selected appointments'
