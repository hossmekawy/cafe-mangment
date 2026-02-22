from rest_framework import serializers
from .models import (
    Unit, UnitConversion, StorageLocation, RawMaterial, StockBatch,
    StockMovement, WasteLog, PhysicalCountItem, PhysicalCount,
    MenuCategory, Product, ProductVariation, ComboItem, Recipe, RecipeIngredient, Notification
)

class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = '__all__'

class UnitConversionSerializer(serializers.ModelSerializer):
    from_unit_name = serializers.CharField(source='from_unit.name', read_only=True)
    to_unit_name = serializers.CharField(source='to_unit.name', read_only=True)
    from_unit_abbreviation = serializers.CharField(source='from_unit.abbreviation', read_only=True)
    to_unit_abbreviation = serializers.CharField(source='to_unit.abbreviation', read_only=True)

    class Meta:
        model = UnitConversion
        fields = '__all__'

class StorageLocationSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    
    class Meta:
        model = StorageLocation
        fields = '__all__'

class RawMaterialSerializer(serializers.ModelSerializer):
    unit_details = UnitSerializer(source='unit', read_only=True)
    storage_location_details = StorageLocationSerializer(source='storage_location', read_only=True)
    
    class Meta:
        model = RawMaterial
        fields = '__all__'
        read_only_fields = ['current_stock']

class RawMaterialListSerializer(serializers.ModelSerializer):
    """Lighter version for dropdowns and lists"""
    unit_abbreviation = serializers.CharField(source='unit.abbreviation', read_only=True)
    storage_location_name = serializers.CharField(source='storage_location.name', read_only=True)
    preferred_supplier_name = serializers.CharField(source='preferred_supplier.name', read_only=True)
    
    class Meta:
        model = RawMaterial
        fields = [
            'id', 'name', 'name_ar', 'category', 'current_stock', 
            'minimum_stock', 'reorder_quantity', 'unit', 'unit_abbreviation', 'storage_location_name', 
            'preferred_supplier_name', 'cost_per_unit', 'is_active', 'expiry_tracked'
        ]

class StockBatchSerializer(serializers.ModelSerializer):
    raw_material_name = serializers.CharField(source='raw_material.name', read_only=True)
    
    class Meta:
        model = StockBatch
        fields = '__all__'

class StockMovementSerializer(serializers.ModelSerializer):
    raw_material_name = serializers.CharField(source='raw_material.name', read_only=True)
    performed_by_name = serializers.CharField(source='performed_by.name', read_only=True)
    
    class Meta:
        model = StockMovement
        fields = '__all__'
        read_only_fields = ['quantity_before', 'quantity_after']

class WasteLogSerializer(serializers.ModelSerializer):
    raw_material_name = serializers.CharField(source='raw_material.name', read_only=True)
    logged_by_name = serializers.CharField(source='logged_by.name', read_only=True)
    
    class Meta:
        model = WasteLog
        fields = '__all__'
        read_only_fields = ['cost_value'] # Auto-calculated

class PhysicalCountItemSerializer(serializers.ModelSerializer):
    raw_material_name = serializers.CharField(source='raw_material.name', read_only=True)
    
    class Meta:
        model = PhysicalCountItem
        fields = '__all__'
        read_only_fields = ['system_quantity', 'discrepancy', 'discrepancy_value']

class PhysicalCountSerializer(serializers.ModelSerializer):
    items = PhysicalCountItemSerializer(many=True, read_only=True)
    started_by_name = serializers.CharField(source='started_by.name', read_only=True)
    completed_by_name = serializers.CharField(source='completed_by.name', read_only=True)
    
    class Meta:
        model = PhysicalCount
        fields = '__all__'

class MenuCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuCategory
        fields = '__all__'

class ProductVariationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariation
        fields = '__all__'

class ComboItemSerializer(serializers.ModelSerializer):
    child_product_name = serializers.CharField(source='child_product.name', read_only=True)
    class Meta:
        model = ComboItem
        fields = '__all__'

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    linked_raw_material_name = serializers.CharField(source='linked_raw_material.name', read_only=True)
    variations = ProductVariationSerializer(many=True, read_only=True)
    combo_items = ComboItemSerializer(many=True, read_only=True)
    
    class Meta:
        model = Product
        fields = '__all__'

class RecipeIngredientSerializer(serializers.ModelSerializer):
    raw_material_name = serializers.CharField(source='raw_material.name', read_only=True)
    unit_abbreviation = serializers.CharField(source='unit.abbreviation', read_only=True)
    cost = serializers.DecimalField(source='get_cost', max_digits=10, decimal_places=2, read_only=True)
    
    class Meta:
        model = RecipeIngredient
        fields = '__all__'

class RecipeSerializer(serializers.ModelSerializer):
    ingredients = RecipeIngredientSerializer(many=True, read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    variation_name = serializers.CharField(source='variation.size_name', read_only=True)
    target_name = serializers.SerializerMethodField()
    total_cost = serializers.SerializerMethodField()
    
    class Meta:
        model = Recipe
        fields = '__all__'

    def get_target_name(self, obj):
        if obj.modifier:
            return f"Modifier: {obj.modifier.name}"
        if obj.variation:
            return f"{obj.product.name if obj.product else ''} - {obj.variation.size_name}"
        return obj.product.name if obj.product else 'Unknown'

    def get_total_cost(self, obj):
        return sum(ingredient.get_cost() for ingredient in obj.ingredients.all())

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'
