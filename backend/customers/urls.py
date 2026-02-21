from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomerViewSet, TierDefinitionViewSet

router = DefaultRouter()
router.register(r'customers', CustomerViewSet)
router.register(r'tiers', TierDefinitionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
