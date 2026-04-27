"""
Role-Based Permission Classes for Hospital Management System
"""

from rest_framework.permissions import BasePermission
from apps.users.models import User


class IsAdmin(BasePermission):
    """Only Admin users (or Django superusers) can access."""
    message = "Access denied. Admin privileges required."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            (request.user.role == User.Role.ADMIN or request.user.is_superuser)
        )


class IsDoctor(BasePermission):
    """Only Doctor users can access."""
    message = "Access denied. Doctor privileges required."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role == User.Role.DOCTOR
        )


class IsNurse(BasePermission):
    """Only Nurse users can access."""
    message = "Access denied. Nurse privileges required."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role == User.Role.NURSE
        )


class IsReceptionist(BasePermission):
    """Only Receptionist users can access."""
    message = "Access denied. Receptionist privileges required."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role == User.Role.RECEPTIONIST
        )


class IsPatient(BasePermission):
    """Only Patient users can access."""
    message = "Access denied. Patient account required."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role == User.Role.PATIENT
        )


class IsAdminOrDoctor(BasePermission):
    """Admin or Doctor users can access."""
    message = "Access denied. Admin or Doctor privileges required."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role in [User.Role.ADMIN, User.Role.DOCTOR]
        )


class IsAdminOrReceptionist(BasePermission):
    """Admin or Receptionist users can access."""
    message = "Access denied. Admin or Receptionist privileges required."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role in [User.Role.ADMIN, User.Role.RECEPTIONIST]
        )


class IsAdminOrDoctorOrNurse(BasePermission):
    """Admin, Doctor, or Nurse users can access."""
    message = "Access denied. Medical staff privileges required."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role in [User.Role.ADMIN, User.Role.DOCTOR, User.Role.NURSE]
        )


class IsStaffMember(BasePermission):
    """Any staff member (not patient) can access."""
    message = "Access denied. Staff account required."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role != User.Role.PATIENT
        )


class IsOwnerOrAdmin(BasePermission):
    """Object-level permission: owner or admin can access."""
    message = "Access denied. You don't have permission to access this resource."

    def has_object_permission(self, request, view, obj):
        if request.user.role == User.Role.ADMIN:
            return True
        # Check if object has user field
        if hasattr(obj, 'user'):
            return obj.user == request.user
        # Check if object is the user itself
        return obj == request.user
