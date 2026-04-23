"""
User management URL patterns
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from ..views import UserViewSet, UserProfileView, ChangePasswordView

router = DefaultRouter()
router.register(r'', UserViewSet, basename='users')

urlpatterns = [
    path('me/', UserProfileView.as_view(), name='profile'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('', include(router.urls)),
]
