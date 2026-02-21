from rest_framework import serializers
from .models import ModifierGroup, Modifier, Table, Order, OrderItem, Payment
from inventory.models import Product, ProductVariation, ComboItem

class ModifierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Modifier
        fields = '__all__'

class ModifierGroupSerializer(serializers.ModelSerializer):
    modifiers = ModifierSerializer(many=True, read_only=True)
    
    class Meta:
        model = ModifierGroup
        fields = '__all__'

class TableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Table
        fields = '__all__'

class POSProductVariationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariation
        fields = ['id', 'size_name', 'price', 'price_takeaway', 'price_delivery']

class POSComboItemSerializer(serializers.ModelSerializer):
    child_product_name = serializers.CharField(source='child_product.name', read_only=True)
    class Meta:
        model = ComboItem
        fields = ['id', 'child_product', 'child_product_name', 'quantity', 'extra_price']

class POSProductSerializer(serializers.ModelSerializer):
    modifier_groups = ModifierGroupSerializer(many=True, read_only=True)
    variations = POSProductVariationSerializer(many=True, read_only=True)
    combo_items = POSComboItemSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = Product
        fields = [
            'id', 'name', 'name_ar', 'category', 'category_name', 'price', 
            'price_takeaway', 'price_delivery', 'description', 'image', 
            'availability_status', 'modifier_groups', 'variations', 'combo_items'
        ]

class OrderItemSerializer(serializers.ModelSerializer):
    product_name    = serializers.CharField(source='product.name',    read_only=True)
    product_name_ar = serializers.CharField(source='product.name_ar', read_only=True)
    modifiers_details = ModifierSerializer(source='modifiers', many=True, read_only=True)
    
    class Meta:
        model = OrderItem
        fields = '__all__'
        extra_kwargs = {'order': {'read_only': True}} # So it can be created nested

class PaymentSerializer(serializers.ModelSerializer):
    processed_by_name = serializers.CharField(source='processed_by.get_full_name', read_only=True)
    
    class Meta:
        model = Payment
        fields = '__all__'
        extra_kwargs = {'order': {'read_only': True}}

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    table_number = serializers.CharField(source='table.number', read_only=True)
    waiter_name = serializers.CharField(source='assigned_waiter.get_full_name', read_only=True)
    customer_name = serializers.CharField(source='customer.first_name', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)
    
    class Meta:
        model = Order
        fields = '__all__'

class OrderCreateSerializer(serializers.ModelSerializer):
    items = serializers.ListField(child=serializers.DictField(), write_only=True)
    
    class Meta:
        model = Order
        fields = ['id', 'order_type', 'customer', 'table', 'assigned_waiter', 'notes', 'items', 'subtotal', 'tax_amount', 'service_charge', 'discount_amount', 'total_amount']

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        order = Order.objects.create(**validated_data)
        
        if order.table and order.order_type == 'dine_in':
            order.table.status = 'occupied'
            order.table.save()
        
        for item_data in items_data:
            product_id = item_data.get('product')
            quantity = item_data.get('quantity', 1)
            modifiers_ids = item_data.get('modifiers', [])
            special_instructions = item_data.get('special_instructions', '')
            
            product = Product.objects.get(id=product_id)
            unit_price = product.price
            
            # Calculate modifier price
            modifiers = Modifier.objects.filter(id__in=modifiers_ids)
            modifiers_price = sum(float(mod.extra_price) for mod in modifiers)
            
            total_price = (float(unit_price) + modifiers_price) * int(quantity)
            
            order_item = OrderItem.objects.create(
                order=order,
                product=product,
                quantity=quantity,
                unit_price=unit_price,
                total_price=total_price,
                special_instructions=special_instructions
            )
            order_item.modifiers.set(modifiers)

        # Total computation logic should ideally happen here or in the frontend.
        # If frontend sends it, we are just saving it (which is simpler for a complex POS).
        return order

    def update(self, instance, validated_data):
        """Update a pending draft order: replace its items and recalculate totals."""
        items_data = validated_data.pop('items', None)

        # Update scalar fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Replace items only when a new item list is provided
        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                product_id = item_data.get('product')
                quantity = item_data.get('quantity', 1)
                modifiers_ids = item_data.get('modifiers', [])
                special_instructions = item_data.get('special_instructions', '')

                product = Product.objects.get(id=product_id)
                unit_price = product.price

                modifiers = Modifier.objects.filter(id__in=modifiers_ids)
                modifiers_price = sum(float(mod.extra_price) for mod in modifiers)
                total_price = (float(unit_price) + modifiers_price) * int(quantity)

                order_item = OrderItem.objects.create(
                    order=instance,
                    product=product,
                    quantity=quantity,
                    unit_price=unit_price,
                    total_price=total_price,
                    special_instructions=special_instructions,
                )
                order_item.modifiers.set(modifiers)

        return instance
