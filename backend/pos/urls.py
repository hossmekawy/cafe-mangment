from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    POSProductViewSet, TableViewSet, ModifierGroupViewSet,
    ModifierViewSet, OrderViewSet, OrderItemViewSet
)

router = DefaultRouter()
router.register(r'products', POSProductViewSet, basename='pos-product')
router.register(r'tables', TableViewSet, basename='table')
router.register(r'modifier-groups', ModifierGroupViewSet, basename='modifier-group')
router.register(r'modifiers', ModifierViewSet, basename='modifier')
router.register(r'orders', OrderViewSet, basename='order')
router.register(r'kds-items', OrderItemViewSet, basename='kds-item')

urlpatterns = [
    path('', include(router.urls)),
]
