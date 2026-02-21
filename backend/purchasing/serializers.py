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
    items = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)

    class Meta:
        model = PurchaseOrder
        fields = '__all__'
        read_only_fields = ['po_number', 'created_by']

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        
        # Auto-generate po_number
        count = PurchaseOrder.objects.count() + 1
        po_number = f"PO-{count:05d}"
        
        purchase_order = PurchaseOrder.objects.create(po_number=po_number, **validated_data)
        
        for item in items_data:
            PurchaseOrderItem.objects.create(
                purchase_order=purchase_order,
                raw_material_id=item.get('raw_material'),
                quantity_ordered=item.get('quantity_ordered'),
                unit_price=item.get('unit_price'),
                total_price=item.get('total_price', 0)
            )
            
        return purchase_order

class GoodsReceivedNoteCreateSerializer(serializers.ModelSerializer):
    items = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)

    class Meta:
        model = GoodsReceivedNote
        fields = '__all__'
        read_only_fields = ['grn_number', 'received_by']

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        
        count = GoodsReceivedNote.objects.count() + 1
        grn_number = f"GRN-{count:05d}"
        
        grn = GoodsReceivedNote.objects.create(grn_number=grn_number, **validated_data)
        
        for item in items_data:
            GRNItem.objects.create(
                grn=grn,
                raw_material_id=item.get('raw_material'),
                quantity_ordered=item.get('quantity_ordered', 0),
                quantity_received=item.get('quantity_received'),
                unit_price=item.get('unit_price'),
                expiry_date=item.get('expiry_date') or None
            )
            
        return grn

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
