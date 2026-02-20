from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, CustomTokenObtainPairView, LogoutView, MeView,
    ChangePasswordView, ForgotPasswordView, ResetPasswordView,
    SetPINView, PINLoginView, SessionListView, SessionRevokeView,
    AdminUserListView, AdminUserCreateView
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth_register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('logout/', LogoutView.as_view(), name='auth_logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', MeView.as_view(), name='auth_me'),
    
    path('admin/users/', AdminUserListView.as_view(), name='admin_user_list'),
    path('admin/users/create/', AdminUserCreateView.as_view(), name='admin_user_create'),
    
    path('password/change/', ChangePasswordView.as_view(), name='auth_change_password'),
    path('password/forgot/', ForgotPasswordView.as_view(), name='auth_forgot_password'),
    path('password/reset/', ResetPasswordView.as_view(), name='auth_reset_password'),
    
    path('pin/set/', SetPINView.as_view(), name='auth_set_pin'),
    path('pin/login/', PINLoginView.as_view(), name='auth_pin_login'),
    
    path('sessions/', SessionListView.as_view(), name='auth_sessions'),
    path('sessions/<uuid:pk>/', SessionRevokeView.as_view(), name='auth_session_revoke'),
    path('sessions/revoke-all/', SessionRevokeView.as_view(), name='auth_session_revoke_all'),
]
