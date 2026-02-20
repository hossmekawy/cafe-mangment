from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UnitViewSet, StorageLocationViewSet, RawMaterialViewSet,
    StockMovementViewSet, WasteLogViewSet, PhysicalCountViewSet,
    RecipeViewSet, NotificationViewSet
)

router = DefaultRouter()
router.register(r'units', UnitViewSet)
router.register(r'locations', StorageLocationViewSet)
router.register(r'materials', RawMaterialViewSet)
router.register(r'movements', StockMovementViewSet)
router.register(r'waste', WasteLogViewSet)
router.register(r'physical-counts', PhysicalCountViewSet)
router.register(r'recipes', RecipeViewSet)
router.register(r'alerts', NotificationViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
