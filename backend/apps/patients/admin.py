from django.contrib import admin
from .models import Patient


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ['get_full_name', 'email', 'blood_group', 'age', 'created_at']
    list_filter = ['blood_group']
    search_fields = ['user__first_name', 'user__last_name', 'user__email', 'insurance_number']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at', 'age']
    raw_id_fields = ['user']

    def get_full_name(self, obj):
        return obj.full_name
    get_full_name.short_description = 'Patient'

    def email(self, obj):
        return obj.email
