"""
Authentication URL patterns
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from ..views import (
    LoginView,
    PatientRegisterView,
    LogoutView,
    VerifyEmailView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
)

app_name = 'auth'

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('register/', PatientRegisterView.as_view(), name='register'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('verify-email/<uuid:token>/', VerifyEmailView.as_view(), name='verify-email'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
]
