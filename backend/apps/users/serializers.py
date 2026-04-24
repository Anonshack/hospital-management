"""
User Serializers - Authentication, Registration, Profile
"""

import uuid
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from datetime import timedelta
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['email'] = user.email
        token['full_name'] = user.get_full_name()
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        data['user'] = {
            'id': user.id,
            'email': user.email,
            'full_name': user.get_full_name(),
            'role': user.role,
            'avatar': user.avatar.url if user.avatar else None,
            'is_verified': user.is_verified,
        }
        return data


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True, required=True,
        style={'input_type': 'password'}
    )

    class Meta:
        model = User
        fields = [
            'email', 'username', 'first_name', 'last_name',
            'phone', 'password', 'password_confirm',
        ]
        extra_kwargs = {
            'first_name': {'required': True},
            'last_name': {'required': True},
            'email': {'required': True},
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.role = User.Role.PATIENT
        user.set_password(password)
        user.save()
        return user


class AdminCreateUserSerializer(serializers.ModelSerializer):
    """
    Admin creates staff accounts (Doctor, Nurse, Receptionist).
    Supports avatar upload + doctor-specific fields.
    """
    password = serializers.CharField(write_only=True, required=True)
    avatar = serializers.ImageField(required=False, allow_null=True)
    gender = serializers.ChoiceField(choices=['male', 'female'], required=False, default='male')

    # Doctor-specific fields (passed as extra data, not model fields)
    specialization = serializers.CharField(required=False, allow_blank=True)
    experience_years = serializers.IntegerField(required=False, default=0)
    consultation_fee = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)
    license_number = serializers.CharField(required=False, allow_blank=True)
    bio = serializers.CharField(required=False, allow_blank=True)
    department = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            'email', 'username', 'first_name', 'last_name',
            'phone', 'role', 'password', 'avatar', 'gender',
            'specialization', 'experience_years', 'consultation_fee',
            'license_number', 'bio', 'department',
        ]
        extra_kwargs = {
            'first_name': {'required': True},
            'last_name': {'required': True},
            'username': {'required': False, 'allow_blank': True},
        }

    def validate_role(self, value):
        # Only superusers can create admin accounts
        request = self.context.get('request')
        if value == User.Role.ADMIN and request and not request.user.is_superuser:
            raise serializers.ValidationError("Faqat superuser admin yarata oladi.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Bu email allaqachon ro'yxatdan o'tgan.")
        return value.lower()

    def _unique_username(self, base):
        """Generate a unique username from base string."""
        import re
        base = re.sub(r'[^\w]', '', base.split('@')[0])[:20] or 'user'
        username = base
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base}{counter}"
            counter += 1
        return username

    def create(self, validated_data):
        from django.db import transaction, IntegrityError
        
        specialization = validated_data.pop('specialization', '')
        experience_years = validated_data.pop('experience_years', 0)
        consultation_fee = validated_data.pop('consultation_fee', 0)
        license_number = validated_data.pop('license_number', '')
        bio = validated_data.pop('bio', '')
        department_id = validated_data.pop('department', None)
        gender = validated_data.pop('gender', 'male')
        password = validated_data.pop('password')

        # Always auto-generate unique username
        email = validated_data.get('email', '')
        validated_data['username'] = self._unique_username(email)

        sid = transaction.savepoint()
        try:
            user = User(**validated_data)
            user.gender = gender
            user.set_password(password)
            user.is_verified = True
            user.save()

            if user.role == User.Role.DOCTOR:
                from apps.doctors.models import Doctor
                
                doctor_kwargs = {
                    'specialization': specialization or 'General Medicine',
                    'experience_years': experience_years or 0,
                    'consultation_fee': consultation_fee or 0,
                    'license_number': license_number or '',
                    'bio': bio or '',
                    'is_available': True,
                }
                if department_id:
                    from apps.departments.models import Department
                    try:
                        doctor_kwargs['department'] = Department.objects.get(id=department_id)
                    except Department.DoesNotExist:
                        pass
                
                # Use get_or_create to avoid duplicate
                doctor, created = Doctor.objects.get_or_create(user=user, defaults=doctor_kwargs)
                if not created:
                    # Update existing doctor profile
                    for key, value in doctor_kwargs.items():
                        setattr(doctor, key, value)
                    doctor.save()

            elif user.role == User.Role.PATIENT:
                from apps.patients.models import Patient
                Patient.objects.get_or_create(user=user)

            transaction.savepoint_commit(sid)
            return user
            
        except IntegrityError as e:
            transaction.savepoint_rollback(sid)
            raise serializers.ValidationError({"detail": "Ma'lumotlar bazasida xatolik. Iltimos qaytadan urinib ko'ring."})
        except Exception as e:
            transaction.savepoint_rollback(sid)
            raise serializers.ValidationError({"detail": f"Xatolik: {str(e)}"})


class UserProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name',
            'full_name', 'phone', 'avatar', 'avatar_url', 'role',
            'is_verified', 'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'role', 'is_verified', 'created_at', 'updated_at']
        extra_kwargs = {
            'username': {'required': False},
            'email': {'required': False},
        }

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_avatar_url(self, obj):
        if obj.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.avatar.url)
        return None

    def update(self, instance, validated_data):
        # If email changed, ensure uniqueness
        new_email = validated_data.get('email')
        if new_email and new_email != instance.email:
            if User.objects.filter(email__iexact=new_email).exclude(pk=instance.pk).exists():
                raise serializers.ValidationError({'email': 'Bu email allaqachon ishlatilmoqda.'})
        # Auto-fix username if not provided or conflicts
        if 'username' not in validated_data or not validated_data.get('username'):
            pass  # keep existing
        return super().update(instance, validated_data)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(required=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({"new_password": "Password fields didn't match."})
        return attrs

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is not correct.")
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.UUIDField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(required=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({"new_password": "Password fields didn't match."})
        return attrs


class UserListSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    doctor_profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name', 'full_name', 
            'role', 'phone', 'gender', 'is_verified', 'is_active', 
            'avatar', 'created_at', 'doctor_profile',
        ]

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_avatar(self, obj):
        if obj.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.avatar.url)
        return None
    
    def get_doctor_profile(self, obj):
        if obj.role == 'doctor' and hasattr(obj, 'doctor_profile'):
            profile = obj.doctor_profile
            return {
                'specialization': profile.specialization,
                'experience_years': profile.experience_years,
                'consultation_fee': str(profile.consultation_fee),
                'license_number': profile.license_number,
                'bio': profile.bio,
                'department': profile.department_id,
            }
        return None