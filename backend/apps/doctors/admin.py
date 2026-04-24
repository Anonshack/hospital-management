from django.contrib import admin
from .models import Doctor, DoctorSchedule


class DoctorScheduleInline(admin.TabularInline):
    model = DoctorSchedule
    extra = 0
    fields = ['day_of_week', 'start_time', 'end_time', 'slot_duration', 'is_active']


@admin.register(Doctor)
class DoctorAdmin(admin.ModelAdmin):
    list_display = ['get_full_name', 'specialization', 'department', 'experience_years', 'is_available', 'created_at']
    list_filter = ['specialization', 'department', 'is_available']
    search_fields = ['user__first_name', 'user__last_name', 'user__email', 'specialization', 'license_number']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [DoctorScheduleInline]
    raw_id_fields = ['user', 'department']

    def get_full_name(self, obj):
        return obj.full_name
    get_full_name.short_description = 'Doctor'


@admin.register(DoctorSchedule)
class DoctorScheduleAdmin(admin.ModelAdmin):
    list_display = ['doctor', 'get_day_name', 'start_time', 'end_time', 'slot_duration', 'is_active']
    list_filter = ['day_of_week', 'is_active']
    search_fields = ['doctor__user__first_name', 'doctor__user__last_name']
    ordering = ['doctor', 'day_of_week']

    def get_day_name(self, obj):
        return obj.get_day_of_week_display()
    get_day_name.short_description = 'Day'
