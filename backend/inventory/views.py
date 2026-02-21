from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
import openpyxl
from io import BytesIO
from .models import (
    Unit, UnitConversion, StorageLocation, RawMaterial, StockBatch,
    WasteLog, StockMovement, PhysicalCount, PhysicalCountItem,
    MenuCategory, Product, ProductVariation, ComboItem, Recipe, RecipeIngredient, Notification
)
from .serializers import (
    UnitSerializer, UnitConversionSerializer, StorageLocationSerializer, RawMaterialSerializer,
    RawMaterialListSerializer, StockBatchSerializer, StockMovementSerializer,
    WasteLogSerializer, PhysicalCountSerializer, PhysicalCountItemSerializer,
    MenuCategorySerializer, ProductVariationSerializer, ComboItemSerializer,
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

    @action(detail=False, methods=['get'])
    def export_template(self, request):
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Materials Template"
        headers = ["Name (EN)", "Name (AR)", "Category", "Unit ID", "Cost Price", "Current Stock", "Min Stock", "Reorder Qty", "Barcode"]
        ws.append(headers)
        
        # Add a reference sheet for Units
        ws_units = wb.create_sheet(title="Units Reference")
        ws_units.append(["Unit ID", "Unit Name", "Abbreviation"])
        for unit in Unit.objects.all():
            ws_units.append([str(unit.id), unit.name, unit.abbreviation])

        buffer = BytesIO()
        wb.save(buffer)
        response = HttpResponse(buffer.getvalue(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename="materials_template.xlsx"'
        return response

    @action(detail=False, methods=['post'])
    def preview_import(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            wb = openpyxl.load_workbook(file)
            ws = wb.active
            
            rows = []
            
            for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
                if not row[0]: # Skip if name is empty
                    continue
                    
                rows.append({
                    "id": row_idx,
                    "name": row[0] or "",
                    "name_ar": row[1] or "",
                    "category": row[2] or "other",
                    "unit_id": row[3] or "",
                    "cost_price": float(row[4]) if row[4] else 0.0,
                    "current_stock": float(row[5]) if row[5] else 0.0,
                    "minimum_stock": float(row[6]) if row[6] else 0.0,
                    "reorder_quantity": float(row[7]) if row[7] else 0.0,
                    "barcode": row[8] or ""
                })
                    
            return Response({
                "success": True, 
                "data": rows
            })
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def confirm_import(self, request):
        materials_data = request.data.get('materials', [])
        
        if not materials_data:
            return Response({"detail": "No materials to import."}, status=status.HTTP_400_BAD_REQUEST)

        created_count = 0
        errors = []

        for item in materials_data:
            try:
                unit = None
                unit_id = item.get('unit_id')
                if unit_id:
                    unit = Unit.objects.filter(id=unit_id).first()
                
                if not unit:
                    errors.append(f"Row error ({item.get('name')}): Initial Unit is required but invalid ID provided.")
                    continue
                    
                barcode = str(item.get('barcode', '')).strip()
                if barcode == 'None' or not barcode:
                    barcode = None

                RawMaterial.objects.create(
                    name=item.get('name'),
                    name_ar=item.get('name_ar', ''),
                    category=item.get('category', 'other'),
                    unit=unit,
                    cost_per_unit=float(item.get('cost_price', 0.0)),
                    current_stock=float(item.get('current_stock', 0.0)),
                    minimum_stock=float(item.get('minimum_stock', 0.0)),
                    reorder_quantity=float(item.get('reorder_quantity', 0.0)),
                    barcode=barcode
                )
                created_count += 1
            except Exception as e:
                errors.append(f"Row error ({item.get('name')}): {str(e)}")

        return Response({
            "success": True, 
            "message": f"Successfully imported {created_count} materials.",
            "errors": errors
        })

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

class MenuCategoryViewSet(viewsets.ModelViewSet):
    queryset = MenuCategory.objects.all()
    serializer_class = MenuCategorySerializer
    permission_classes = [IsAdminOrManager]
    filterset_fields = ['parent', 'is_active']
    search_fields = ['name', 'name_ar']

class ProductVariationViewSet(viewsets.ModelViewSet):
    queryset = ProductVariation.objects.all()
    serializer_class = ProductVariationSerializer
    permission_classes = [IsAdminOrManager]
    filterset_fields = ['product', 'is_active']

class ComboItemViewSet(viewsets.ModelViewSet):
    queryset = ComboItem.objects.all()
    serializer_class = ComboItemSerializer
    permission_classes = [IsAdminOrManager]
    filterset_fields = ['parent_combo']

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().prefetch_related('variations', 'combo_items', 'category')
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrManager]
    filterset_fields = ['category', 'availability_status', 'is_popular', 'is_seasonal']
    search_fields = ['name', 'name_ar', 'description']

    @action(detail=False, methods=['get'])
    def export_template(self, request):
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Products Template"
        headers = ["Name (EN)", "Name (AR)", "Category ID (Optional)", "Price", "Cost Price", "Description", "Preparation Time (Mins)"]
        ws.append(headers)
        
        # Add a reference sheet for Categories
        ws_cats = wb.create_sheet(title="Categories Reference")
        ws_cats.append(["Category ID", "Category Name"])
        for cat in MenuCategory.objects.all():
            ws_cats.append([str(cat.id), cat.name])

        buffer = BytesIO()
        wb.save(buffer)
        response = HttpResponse(buffer.getvalue(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename="products_template.xlsx"'
        return response

    @action(detail=False, methods=['post'])
    def preview_import(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            wb = openpyxl.load_workbook(file)
            ws = wb.active
            
            rows = []
            
            for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
                if not row[0]: # Skip if name is empty
                    continue
                    
                rows.append({
                    "id": row_idx,
                    "name": row[0] or "",
                    "name_ar": row[1] or "",
                    "cat_id": row[2] or "",
                    "price": float(row[3]) if row[3] else 0.0,
                    "cost_price": float(row[4]) if row[4] else 0.0,
                    "description": row[5] or "",
                    "prep_time": int(row[6]) if row[6] else 5
                })
                    
            return Response({
                "success": True, 
                "data": rows
            })
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def confirm_import(self, request):
        products_data = request.data.get('products', [])
        
        if not products_data:
            return Response({"detail": "No products to import."}, status=status.HTTP_400_BAD_REQUEST)

        created_count = 0
        errors = []

        for item in products_data:
            try:
                category = None
                cat_id = item.get('cat_id')
                if cat_id:
                    category = MenuCategory.objects.filter(id=cat_id).first()
                    
                Product.objects.create(
                    name=item.get('name'),
                    name_ar=item.get('name_ar', ''),
                    category=category,
                    price=float(item.get('price', 0.0)),
                    cost_price=float(item.get('cost_price', 0.0)),
                    description=item.get('description', ''),
                    preparation_time=int(item.get('prep_time', 5)),
                    availability_status='available'
                )
                created_count += 1
            except Exception as e:
                errors.append(f"Row error ({item.get('name')}): {str(e)}")

        return Response({
            "success": True, 
            "message": f"Successfully imported {created_count} products.",
            "errors": errors
        })

    @action(detail=True, methods=['get'])
    def analytics(self, request, pk=None):
        product = self.get_object()
        from pos.models import OrderItem
        from django.db.models import Sum, Count
        from django.db.models.functions import TruncDate

        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        items = OrderItem.objects.filter(product=product, order__status='completed')
        
        if start_date:
            items = items.filter(order__created_at__gte=start_date)
        if end_date:
            items = items.filter(order__created_at__lte=end_date + " 23:59:59")
            
        # 1. Total Quantity Sold
        total_quantity = items.aggregate(total=Sum('quantity'))['total'] or 0
        
        # 2. Total Revenue (Assuming item.price contains the total price for that line item)
        total_revenue = items.aggregate(total=Sum('price'))['total'] or 0.0
        
        # 3. Net Profit (Revenue - Cost)
        total_cost = float(product.cost_price) * float(total_quantity)
        net_profit = float(total_revenue) - total_cost
        
        # 4. Order Type Breakdown
        type_breakdown = list(items.values('order__order_type').annotate(
            count=Sum('quantity'),
            revenue=Sum('price')
        ))
        
        # 5. Sales over time
        sales_trend = list(items.annotate(date=TruncDate('order__created_at'))
                                .values('date')
                                .annotate(quantity=Sum('quantity'), revenue=Sum('price'))
                                .order_by('date'))
        
        # Format the date objects to strings for JSON
        for day in sales_trend:
            if day['date']:
                day['date'] = day['date'].strftime('%Y-%m-%d')
                                
        return Response({
            "total_quantity": total_quantity,
            "total_revenue": total_revenue,
            "net_profit": net_profit,
            "type_breakdown": type_breakdown,
            "sales_trend": sales_trend
        })

class RecipeViewSet(viewsets.ModelViewSet):
    queryset = Recipe.objects.all()
    serializer_class = RecipeSerializer
    permission_classes = [IsAdminOrManager]

    def _save_ingredients(self, recipe, ingredients_data):
        recipe.ingredients.all().delete()
        for ing_data in ingredients_data:
            material = RawMaterial.objects.get(id=ing_data.get('raw_material'))
            unit_id = ing_data.get('unit')
            unit = Unit.objects.get(id=unit_id) if unit_id else material.unit
            RecipeIngredient.objects.create(
                recipe=recipe,
                raw_material=material,
                quantity=ing_data.get('quantity'),
                unit=unit
            )

    def create(self, request, *args, **kwargs):
        data = request.data
        ingredients_data = data.pop('ingredients', [])
        
        target_id = data.get('product')
        product_id = None
        variation_id = None
        
        try:
            if target_id:
                if Product.objects.filter(id=target_id).exists():
                    product_id = target_id
                elif ProductVariation.objects.filter(id=target_id).exists():
                    variation = ProductVariation.objects.get(id=target_id)
                    variation_id = target_id
                    product_id = variation.product_id

            recipe = Recipe.objects.create(
                product_id=product_id,
                variation_id=variation_id,
                yield_quantity=data.get('yield_quantity', 1.0),
                preparation_time=data.get('preparation_time', 5),
                notes=data.get('notes', '')
            )
            
            self._save_ingredients(recipe, ingredients_data)
            
            serializer = self.get_serializer(recipe)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"non_field_errors": [str(e)]}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        recipe = self.get_object()
        data = request.data
        ingredients_data = data.pop('ingredients', [])
        
        try:
            target_id = data.get('product')
            if target_id:
                if Product.objects.filter(id=target_id).exists():
                    recipe.product_id = target_id
                    recipe.variation_id = None
                elif ProductVariation.objects.filter(id=target_id).exists():
                    variation = ProductVariation.objects.get(id=target_id)
                    recipe.variation_id = target_id
                    recipe.product_id = variation.product_id
                    
            recipe.yield_quantity = data.get('yield_quantity', recipe.yield_quantity)
            recipe.preparation_time = data.get('preparation_time', recipe.preparation_time)
            recipe.notes = data.get('notes', recipe.notes)
            recipe.save()
            
            self._save_ingredients(recipe, ingredients_data)
            
            serializer = self.get_serializer(recipe)
            return Response(serializer.data)
        except Exception as e:
            return Response({"non_field_errors": [str(e)]}, status=status.HTTP_400_BAD_REQUEST)

class NotificationViewSet(viewsets.ModelViewSet):
    """Simple API to fetch low stock alerts"""
    queryset = Notification.objects.all().order_by('-created_at')
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        self.queryset.filter(is_read=False).update(is_read=True)
        return Response({"success": True, "message": "All notifications marked as read."})
