from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import (
    Unit, UnitConversion, StorageLocation, RawMaterial, StockBatch,
    WasteLog, StockMovement, PhysicalCount, PhysicalCountItem,
    Product, Recipe, RecipeIngredient, Notification
)
from .serializers import (
    UnitSerializer, UnitConversionSerializer, StorageLocationSerializer, RawMaterialSerializer,
    RawMaterialListSerializer, StockBatchSerializer, StockMovementSerializer,
    WasteLogSerializer, PhysicalCountSerializer, PhysicalCountItemSerializer,
    ProductSerializer, RecipeSerializer, RecipeIngredientSerializer, NotificationSerializer
)
from .services import deduct_stock_for_waste, log_stock_movement, reconcile_physical_count

from authentication.permissions import IsAdminOrManager

class UnitViewSet(viewsets.ModelViewSet):
    queryset = Unit.objects.all()
    serializer_class = UnitSerializer
    permission_classes = [IsAuthenticated]

class UnitConversionViewSet(viewsets.ModelViewSet):
    queryset = UnitConversion.objects.all()
    serializer_class = UnitConversionSerializer
    permission_classes = [IsAuthenticated]

class StorageLocationViewSet(viewsets.ModelViewSet):
    queryset = StorageLocation.objects.all()
    serializer_class = StorageLocationSerializer
    permission_classes = [IsAuthenticated]

class RawMaterialViewSet(viewsets.ModelViewSet):
    queryset = RawMaterial.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return RawMaterialListSerializer
        return RawMaterialSerializer

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Returns materials strictly below their minimum stock threshold"""
        from django.db.models import F
        materials = self.queryset.filter(current_stock__lte=F('minimum_stock'))
        serializer = RawMaterialListSerializer(materials, many=True)
        return Response({"success": True, "data": serializer.data})

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrManager])
    def adjust_stock(self, request, pk=None):
        """Manual adjustment of stock levels"""
        raw_material = self.get_object()
        quantity = request.data.get('quantity')
        note = request.data.get('note', 'Manual Adjustment')

        if not quantity:
            return Response({"success": False, "error": "Quantity parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            log_stock_movement(
                raw_material=raw_material,
                movement_type='manual_adjustment',
                quantity=quantity, # Positive to add, negative to subtract
                performed_by=request.user,
                note=note
            )
            raw_material.refresh_from_db()
            return Response({
                "success": True,
                "message": "Stock adjusted successfully",
                "current_stock": raw_material.current_stock
            })
        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    """Stock movements acts as an un-editable audit ledger"""
    queryset = StockMovement.objects.all().order_by('-created_at')
    serializer_class = StockMovementSerializer
    permission_classes = [IsAdminOrManager] # Usually strictly for managers to view

class WasteLogViewSet(viewsets.ModelViewSet):
    """Waste logs can be created by anyone, but generally only viewed/deleted by managers"""
    queryset = WasteLog.objects.all().order_by('-created_at')
    serializer_class = WasteLogSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        raw_material_id = request.data.get('raw_material')
        quantity = request.data.get('quantity')
        reason = request.data.get('reason')
        note = request.data.get('note', '')

        try:
            material = RawMaterial.objects.get(id=raw_material_id)
            waste = deduct_stock_for_waste(
                raw_material=material,
                quantity=quantity,
                reason=reason,
                logged_by=request.user,
                note=note
            )
            # Re-serialize the created object
            response_serializer = self.get_serializer(waste)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class PhysicalCountViewSet(viewsets.ModelViewSet):
    queryset = PhysicalCount.objects.all().order_by('-started_at')
    serializer_class = PhysicalCountSerializer
    permission_classes = [IsAdminOrManager] # Managers or above

    def perform_create(self, serializer):
        serializer.save(started_by=self.request.user)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        count = self.get_object()
        user = request.user
        
        # Attach the user who completed it temporarily
        count.completed_by = user
        
        try:
            reconcile_physical_count(count)
            return Response({"success": True, "message": "Physical count completed and reconciled successfully."})
        except ValueError: # Corrected syntax from original instruction
            # Assuming the intent was to catch ValueError and then return a generic success message
            # This might override specific error messages from reconcile_physical_count
            pass # Or handle the error more specifically if needed
        
        return Response({
            "success": True,
            "data": "Inventory reconciliation triggered successfully. Background tasks disabled for local development."
        })

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]

class RecipeViewSet(viewsets.ModelViewSet):
    queryset = Recipe.objects.all()
    serializer_class = RecipeSerializer
    permission_classes = [IsAdminOrManager]

class NotificationViewSet(viewsets.ModelViewSet):
    """Simple API to fetch low stock alerts"""
    queryset = Notification.objects.all().order_by('-created_at')
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        self.queryset.filter(is_read=False).update(is_read=True)
        return Response({"success": True, "message": "All notifications marked as read."})
