from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SupplierViewSet, PurchaseOrderViewSet,
    GoodsReceivedNoteViewSet, SupplierInvoiceViewSet
)

router = DefaultRouter()
router.register(r'suppliers', SupplierViewSet)
router.register(r'purchase-orders', PurchaseOrderViewSet)
router.register(r'grns', GoodsReceivedNoteViewSet)
router.register(r'invoices', SupplierInvoiceViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
