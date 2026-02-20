from rest_framework import serializers
from .models import (
    Unit, StorageLocation, RawMaterial, StockBatch,
    WasteLog, StockMovement, PhysicalCount,
    PhysicalCountItem, Recipe, RecipeIngredient, Notification
)

class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
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
            'minimum_stock', 'unit_abbreviation', 'storage_location_name', 
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

class RecipeIngredientSerializer(serializers.ModelSerializer):
    raw_material_name = serializers.CharField(source='raw_material.name', read_only=True)
    unit_abbreviation = serializers.CharField(source='unit.abbreviation', read_only=True)
    
    class Meta:
        model = RecipeIngredient
        fields = '__all__'

class RecipeSerializer(serializers.ModelSerializer):
    ingredients = RecipeIngredientSerializer(many=True, read_only=True)
    
    class Meta:
        model = Recipe
        fields = '__all__'

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'
