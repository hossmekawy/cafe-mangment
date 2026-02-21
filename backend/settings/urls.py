from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GlobalSettingsView, SystemBackupView, SystemRestoreView, OrderCancelReasonViewSet

router = DefaultRouter()
router.register(r'cancel-reasons', OrderCancelReasonViewSet, basename='cancel-reasons')

urlpatterns = [
    path('', GlobalSettingsView.as_view(), name='global_settings'),
    path('backup/', SystemBackupView.as_view(), name='system_backup'),
    path('restore/', SystemRestoreView.as_view(), name='system_restore'),
    path('', include(router.urls)),
]
