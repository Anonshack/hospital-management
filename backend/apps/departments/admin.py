from django.contrib import admin
from .models import Department


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ['name', 'location', 'contact_number', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'location']
    ordering = ['name']
    readonly_fields = ['created_at', 'updated_at']
