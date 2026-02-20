from rest_framework import serializers
from .models import (
    Supplier, SupplierMaterial, PriceHistory,
    PurchaseOrderTemplate, PurchaseOrder, PurchaseOrderItem,
    GoodsReceivedNote, GRNItem, SupplierInvoice,
    SupplierPayment, SupplierPerformanceLog
)

class SupplierMaterialSerializer(serializers.ModelSerializer):
    raw_material_name = serializers.CharField(source='raw_material.name', read_only=True)
    raw_material_unit = serializers.CharField(source='raw_material.unit.abbreviation', read_only=True)
    
    class Meta:
        model = SupplierMaterial
        fields = '__all__'

class PriceHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceHistory
        fields = '__all__'

class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'

class SupplierDetailSerializer(serializers.ModelSerializer):
    materials_provided = SupplierMaterialSerializer(many=True, read_only=True)
    class Meta:
        model = Supplier
        fields = '__all__'

class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    raw_material_name = serializers.CharField(source='raw_material.name', read_only=True)
    
    class Meta:
        model = PurchaseOrderItem
        fields = '__all__'
        read_only_fields = ['total_price', 'quantity_received']

class PurchaseOrderSerializer(serializers.ModelSerializer):
    items = PurchaseOrderItemSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    
    class Meta:
        model = PurchaseOrder
        fields = '__all__'

class PurchaseOrderCreateSerializer(serializers.ModelSerializer):
    """Flat serializer for creation, items are added separately or via a nested custom create method later"""
    class Meta:
        model = PurchaseOrder
        fields = '__all__'

class GRNItemSerializer(serializers.ModelSerializer):
    raw_material_name = serializers.CharField(source='raw_material.name', read_only=True)
    
    class Meta:
        model = GRNItem
        fields = '__all__'

class GoodsReceivedNoteSerializer(serializers.ModelSerializer):
    items = GRNItemSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    received_by_name = serializers.CharField(source='received_by.name', read_only=True)
    
    class Meta:
        model = GoodsReceivedNote
        fields = '__all__'

class SupplierPaymentSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.CharField(source='recorded_by.name', read_only=True)
    class Meta:
        model = SupplierPayment
        fields = '__all__'

class SupplierInvoiceSerializer(serializers.ModelSerializer):
    payments = SupplierPaymentSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    
    class Meta:
        model = SupplierInvoice
        fields = '__all__'

class SupplierPerformanceLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierPerformanceLog
        fields = '__all__'
