from django.urls import path
from .views import GlobalSettingsView

urlpatterns = [
    path('', GlobalSettingsView.as_view(), name='global_settings'),
]
