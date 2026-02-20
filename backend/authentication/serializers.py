from rest_framework import serializers
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'name', 'avatar', 'role', 'branch', 'is_active', 'created_at')
        read_only_fields = ('id', 'role', 'branch', 'is_active', 'created_at')

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, min_length=8)

    class Meta:
        model = User
        fields = ('id', 'username', 'name', 'password')

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            name=validated_data.get('name', '')
        )
        return user

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Add custom claims
        token['role'] = user.role
        token['branch_id'] = str(user.branch.id) if user.branch else None
        token['username'] = user.username
        
        return token

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)

class ForgotPasswordSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)

class ResetPasswordSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)

class SetPINSerializer(serializers.Serializer):
    pin = serializers.CharField(required=True, min_length=4, max_length=6)

class PINLoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    pin = serializers.CharField(required=True)

from .models import UserSession, AuthAuditLog

class UserSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSession
        fields = ('id', 'device_info', 'ip_address', 'created_at', 'last_used_at')

class AuthAuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuthAuditLog
        fields = ('id', 'action', 'ip_address', 'device_info', 'timestamp')

