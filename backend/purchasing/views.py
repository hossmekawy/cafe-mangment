from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import (
    Supplier, SupplierMaterial, PurchaseOrderTemplate,
    PurchaseOrder, PurchaseOrderItem, GoodsReceivedNote,
    GRNItem, SupplierInvoice, SupplierPayment, SupplierPerformanceLog
)
from .serializers import (
    SupplierSerializer, SupplierDetailSerializer,
    SupplierMaterialSerializer, PurchaseOrderSerializer,
    PurchaseOrderCreateSerializer, PurchaseOrderItemSerializer,
    GoodsReceivedNoteSerializer, GRNItemSerializer,
    SupplierInvoiceSerializer, SupplierPaymentSerializer,
    SupplierPerformanceLogSerializer
)
from .services import complete_grn
from authentication.permissions import IsAdminOrManager

class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrManager()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return SupplierDetailSerializer
        return SupplierSerializer

class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.all().order_by('-created_at')
    permission_classes = [IsAdminOrManager] # Strictly managers/admins

    def get_serializer_class(self):
        if self.action in ['create', 'update']:
            return PurchaseOrderCreateSerializer
        return PurchaseOrderSerializer
        
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        po = self.get_object()
        if po.status != 'draft':
            return Response({"error": "Only draft POs can be confirmed"}, status=status.HTTP_400_BAD_REQUEST)
        po.status = 'confirmed'
        po.save()
        return Response({"success": True, "message": "Purchase Order Confirmed"})
        
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        po = self.get_object()
        if po.grns.filter(status='completed').exists():
            return Response({"error": "Cannot cancel a PO that has completed receiving notes."}, status=status.HTTP_400_BAD_REQUEST)
        po.status = 'cancelled'
        po.save()
        return Response({"success": True, "message": "Purchase Order Cancelled"})

class GoodsReceivedNoteViewSet(viewsets.ModelViewSet):
    queryset = GoodsReceivedNote.objects.all().order_by('-received_date')
    serializer_class = GoodsReceivedNoteSerializer
    permission_classes = [IsAdminOrManager] 

    def perform_create(self, serializer):
        serializer.save(received_by=self.request.user)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        try:
            grn = complete_grn(grn_id=pk, user=request.user)
            return Response({"success": True, "message": f"GRN {grn.grn_number} Completed! Stock Updated."})
        except ValueError as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"success": False, "error": "Fatal Error during completion: " + str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SupplierInvoiceViewSet(viewsets.ModelViewSet):
    queryset = SupplierInvoice.objects.all().order_by('-invoice_date')
    serializer_class = SupplierInvoiceSerializer
    permission_classes = [IsAdminOrManager] # Only managers see financial invoices

    @action(detail=True, methods=['post'])
    def pay(self, request, pk=None):
        invoice = self.get_object()
        amount = request.data.get('amount')
        method = request.data.get('payment_method')
        
        if not amount or not method:
             return Response({"error": "Amount and payment_method are required."}, status=status.HTTP_400_BAD_REQUEST)
             
        # Add payment logic...
        # Update invoice status based on total_amount vs paid_amount
        return Response({"success": True, "message": "Payment logged"})
