"""
User Views - Authentication, Registration, Profile Management
"""

import uuid
import logging
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from core.permissions import IsAdmin, IsOwnerOrAdmin
from .serializers import (
    CustomTokenObtainPairSerializer,
    UserRegistrationSerializer,
    AdminCreateUserSerializer,
    UserProfileSerializer,
    ChangePasswordSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    UserListSerializer,
)
from apps.notifications.services import NotificationService

User = get_user_model()
logger = logging.getLogger(__name__)


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]


class PatientRegisterView(generics.CreateAPIView):
    serializer_class = UserRegistrationSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        try:
            NotificationService.send_verification_email(user)
        except Exception as e:
            logger.warning(f"Failed to send verification email to {user.email}: {e}")

        from apps.patients.models import Patient
        Patient.objects.get_or_create(user=user)

        refresh = RefreshToken.for_user(user)
        return Response({
            'message': 'Registration successful. Please check your email for verification.',
            'user': UserProfileSerializer(user, context={'request': request}).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)


class LogoutView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if not refresh_token:
                return Response(
                    {'error': True, 'message': 'Refresh token is required.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'message': 'Successfully logged out.'}, status=status.HTTP_200_OK)
        except TokenError as e:
            return Response({'error': True, 'message': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class VerifyEmailView(generics.GenericAPIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            user = User.objects.get(verification_token=token, is_verified=False)
            user.is_verified = True
            user.verification_token = uuid.uuid4()
            user.save()
            return Response({'message': 'Email verified successfully.'}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response(
                {'error': True, 'message': 'Invalid or expired verification token.'},
                status=status.HTTP_400_BAD_REQUEST
            )


class PasswordResetRequestView(generics.GenericAPIView):
    serializer_class = PasswordResetRequestSerializer
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        try:
            user = User.objects.get(email=email)
            token = uuid.uuid4()
            user.password_reset_token = token
            user.password_reset_token_expires = timezone.now() + timedelta(hours=2)
            user.save()
            NotificationService.send_password_reset_email(user, token)
        except User.DoesNotExist:
            pass
        return Response({
            'message': 'If an account exists with this email, a password reset link has been sent.'
        })


class PasswordResetConfirmView(generics.GenericAPIView):
    serializer_class = PasswordResetConfirmSerializer
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']
        try:
            user = User.objects.get(
                password_reset_token=token,
                password_reset_token_expires__gt=timezone.now()
            )
            user.set_password(new_password)
            user.password_reset_token = None
            user.password_reset_token_expires = None
            user.save()
            return Response({'message': 'Password reset successfully.'})
        except User.DoesNotExist:
            return Response(
                {'error': True, 'message': 'Invalid or expired reset token.'},
                status=status.HTTP_400_BAD_REQUEST
            )


class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        return self.request.user


class ChangePasswordView(generics.GenericAPIView):
    serializer_class = ChangePasswordSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        return Response({'message': 'Password changed successfully.'})


class UserViewSet(viewsets.ModelViewSet):
    """
    Admin-only CRUD for all users.
    Supports multipart/form-data for avatar uploads.
    """
    queryset = User.objects.all().order_by('-created_at')
    permission_classes = [IsAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ['role', 'is_verified', 'is_active']
    search_fields = ['email', 'first_name', 'last_name', 'phone']
    ordering_fields = ['created_at', 'email', 'role']

    def get_serializer_class(self):
        if self.action == 'create':
            return AdminCreateUserSerializer
        if self.action == 'list':
            return UserListSerializer
        return UserProfileSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def create(self, request, *args, **kwargs):
        import logging
        logger = logging.getLogger(__name__)
        
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except Exception as e:
            logger.error(f"User creation error: {str(e)}", exc_info=True)
            if hasattr(e, 'detail'):
                logger.error(f"Validation errors: {e.detail}")
            raise

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        serializer = UserProfileSerializer(request.user, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def activate(self, request, pk=None):
        user = self.get_object()
        user.is_active = not user.is_active
        user.save()
        status_text = 'activated' if user.is_active else 'deactivated'
        return Response({'message': f'User {status_text} successfully.'})

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def verify(self, request, pk=None):
        user = self.get_object()
        user.is_verified = not user.is_verified
        user.save()
        status_text = 'verified' if user.is_verified else 'unverified'
        return Response({'message': f'User {status_text} successfully.'})

    @action(detail=False, methods=['get'], permission_classes=[IsAdmin])
    def statistics(self, request):
        from django.db.models import Count
        stats = User.objects.values('role').annotate(count=Count('id'))
        return Response({
            'total': User.objects.count(),
            'by_role': {item['role']: item['count'] for item in stats},
            'verified': User.objects.filter(is_verified=True).count(),
            'active': User.objects.filter(is_active=True).count(),
        })