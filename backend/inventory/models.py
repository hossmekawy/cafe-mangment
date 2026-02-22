import uuid
from django.db import models
from django.conf import settings
from authentication.models import Branch

class StorageLocation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='storage_locations')

    def __str__(self):
        return f"{self.name} ({self.branch.name})"

class Unit(models.Model):
    name = models.CharField(max_length=50) # e.g. Kilogram
    abbreviation = models.CharField(max_length=10) # e.g. kg

    def __str__(self):
        return self.abbreviation

class UnitConversion(models.Model):
    from_unit = models.ForeignKey(Unit, related_name='conversions_from', on_delete=models.CASCADE)
    to_unit = models.ForeignKey(Unit, related_name='conversions_to', on_delete=models.CASCADE)
    multiplier = models.DecimalField(max_digits=10, decimal_places=5) # e.g. 1 kg = 1000 g (multiplier=1000)

    class Meta:
        unique_together = ('from_unit', 'to_unit')

    def __str__(self):
        return f"1 {self.from_unit.abbreviation} = {self.multiplier} {self.to_unit.abbreviation}"

class RawMaterial(models.Model):
    CATEGORY_CHOICES = (
        ('dairy', 'Dairy'),
        ('beverages', 'Beverages'),
        ('dry_goods', 'Dry Goods'),
        ('packaging', 'Packaging'),
        ('fresh_produce', 'Fresh Produce'),
        ('cleaning', 'Cleaning & Maintenance'),
        ('other', 'Other'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    name_ar = models.CharField(max_length=150, blank=True, null=True)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='other')
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT)
    
    current_stock = models.DecimalField(max_digits=10, decimal_places=3, default=0.000)
    minimum_stock = models.DecimalField(max_digits=10, decimal_places=3, default=0.000)
    reorder_quantity = models.DecimalField(max_digits=10, decimal_places=3, default=0.000)
    cost_per_unit = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    storage_location = models.ForeignKey(StorageLocation, on_delete=models.SET_NULL, null=True, blank=True)
    preferred_supplier = models.ForeignKey('purchasing.Supplier', on_delete=models.SET_NULL, null=True, blank=True, related_name='preferred_materials')
    
    is_active = models.BooleanField(default=True)
    barcode = models.CharField(max_length=100, blank=True, null=True, unique=True)
    expiry_tracked = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class StockBatch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    raw_material = models.ForeignKey(RawMaterial, on_delete=models.CASCADE, related_name='batches')
    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    cost_per_unit = models.DecimalField(max_digits=10, decimal_places=2)
    expiry_date = models.DateField(null=True, blank=True)
    received_date = models.DateTimeField(auto_now_add=True)
    grn = models.ForeignKey('purchasing.GoodsReceivedNote', on_delete=models.SET_NULL, null=True, blank=True)
    is_depleted = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.raw_material.name} - Batch {self.id.hex[:6]}"

class WasteLog(models.Model):
    REASON_CHOICES = (
        ('expired', 'Expired'),
        ('spillage', 'Spillage'),
        ('damaged', 'Damaged'),
        ('wrong_preparation', 'Wrong Preparation'),
        ('other', 'Other'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    raw_material = models.ForeignKey(RawMaterial, on_delete=models.CASCADE, related_name='waste_logs')
    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    reason = models.CharField(max_length=50, choices=REASON_CHOICES)
    cost_value = models.DecimalField(max_digits=10, decimal_places=2)
    note = models.TextField(blank=True, null=True)
    logged_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.raw_material.name} - {self.quantity} Waste"

class StockMovement(models.Model):
    TYPE_CHOICES = (
        ('purchase', 'Purchase'),
        ('consumption', 'Consumption'),
        ('manual_adjustment', 'Manual Adjustment'),
        ('waste', 'Waste'),
        ('physical_count', 'Physical Count'),
        ('transfer', 'Transfer'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    raw_material = models.ForeignKey(RawMaterial, on_delete=models.CASCADE, related_name='movements')
    movement_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    
    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    quantity_before = models.DecimalField(max_digits=10, decimal_places=3)
    quantity_after = models.DecimalField(max_digits=10, decimal_places=3)
    
    # Explicit nullable FKs for reference
    grn = models.ForeignKey('purchasing.GoodsReceivedNote', on_delete=models.SET_NULL, null=True, blank=True)
    waste_log = models.ForeignKey(WasteLog, on_delete=models.SET_NULL, null=True, blank=True)
    # order = models.ForeignKey('sales.Order', on_delete=models.SET_NULL, null=True, blank=True) # Will add later
    
    note = models.TextField(blank=True, null=True)
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

class PhysicalCount(models.Model):
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    started_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='counts_started')
    completed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='counts_completed')
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

class PhysicalCountItem(models.Model):
    physical_count = models.ForeignKey(PhysicalCount, on_delete=models.CASCADE, related_name='items')
    raw_material = models.ForeignKey(RawMaterial, on_delete=models.CASCADE)
    system_quantity = models.DecimalField(max_digits=10, decimal_places=3)
    counted_quantity = models.DecimalField(max_digits=10, decimal_places=3)
    discrepancy = models.DecimalField(max_digits=10, decimal_places=3)
    discrepancy_value = models.DecimalField(max_digits=10, decimal_places=2)
    note = models.TextField(blank=True, null=True)

class MenuCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    name_ar = models.CharField(max_length=150, blank=True, null=True)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='subcategories')
    description = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to='categories/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    show_in_pos = models.BooleanField(default=True, help_text="Show this category and its products in the POS interface")
    
    # Optional sorting
    order = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Menu Categories"
        ordering = ['order', 'name']

    def __str__(self):
        return f"{self.parent.name} > {self.name}" if self.parent else self.name


class Product(models.Model):
    AVAILABILITY_CHOICES = (
        ('available', 'Available'),
        ('out_of_stock', 'Out of Stock'),
        ('hidden', 'Hidden'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    name_ar = models.CharField(max_length=150, blank=True, null=True)
    
    # Old category field kept temporarily to avoid makemigrations crashing during transition
    legacy_category = models.CharField(max_length=30, null=True, blank=True)
    
    # New relationships
    category = models.ForeignKey(MenuCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Base/Dine-in Price")
    price_takeaway = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    price_delivery = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Calculated or fixed cost for profit margins")
    
    # NEW: Direct raw material link for simple items (Water, Cake) 
    linked_raw_material = models.ForeignKey(RawMaterial, on_delete=models.SET_NULL, null=True, blank=True, help_text="If set, selling this product deducts 1 unit of this raw material directly instead of using a Recipe.")
    
    description = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to='products/', blank=True, null=True)
    
    availability_status = models.CharField(max_length=30, choices=AVAILABILITY_CHOICES, default='available')
    is_popular = models.BooleanField(default=False)
    preparation_time = models.IntegerField(help_text="Average preparation time in minutes", default=5)
    
    is_seasonal = models.BooleanField(default=False)
    season_start_date = models.DateField(null=True, blank=True)
    season_end_date = models.DateField(null=True, blank=True)
    
    available_time_start = models.TimeField(null=True, blank=True, help_text="e.g. 06:00 for breakfast menu")
    available_time_end = models.TimeField(null=True, blank=True, help_text="e.g. 11:30 for breakfast menu")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class ProductVariation(models.Model):
    """ Used for sizes (Small, Medium, Large) or types """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variations')
    
    size_name = models.CharField(max_length=100) # e.g. "Small", "Large"
    
    # Overrides for this specific size
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    price_takeaway = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    price_delivery = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.product.name} - {self.size_name}"

class ComboItem(models.Model):
    """ Bridges a parent Meal/Combo Product to its child Products """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    parent_combo = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='combo_items')
    child_product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='part_of_combos')
    
    quantity = models.IntegerField(default=1)
    extra_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Added to combo base price if selected")

    def __str__(self):
        return f"{self.quantity}x {self.child_product.name} in {self.parent_combo.name}"

class Recipe(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # A recipe can belong to a base product OR a specific variation (size/type) OR a generic Modifier
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='recipes', null=True, blank=True)
    variation = models.ForeignKey(ProductVariation, on_delete=models.CASCADE, related_name='recipe', null=True, blank=True)
    modifier = models.ForeignKey('pos.Modifier', on_delete=models.CASCADE, related_name='recipe', null=True, blank=True)
    
    yield_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1.0)
    preparation_time = models.IntegerField(help_text="In minutes", default=5)
    notes = models.TextField(blank=True, null=True)

    def __str__(self):
        if self.modifier:
             return f"Recipe for Modifier: {self.modifier.name}"
        if self.variation:
            return f"Recipe for {self.variation.product.name} - {self.variation.size_name}"
        return f"Recipe for {self.product.name if self.product else 'Unknown'}"

class RecipeIngredient(models.Model):
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name='ingredients')
    raw_material = models.ForeignKey(RawMaterial, on_delete=models.CASCADE)
    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT, help_text="The unit used in the recipe (e.g. grams)")
    is_optional = models.BooleanField(default=False)

    def get_cost(self):
        # Calculate cost based on unit conversion
        if self.unit == self.raw_material.unit:
            return self.quantity * self.raw_material.cost_per_unit
        
        try:
            conversion = UnitConversion.objects.get(
                from_unit=self.raw_material.unit,
                to_unit=self.unit
            )
            # cost per recipe unit = cost of base unit / multiplier
            # e.g., Base=KG ($10), Recipe Unit=Grams. Multiplier=1000. Grid=10/1000 = $0.01 per gram.
            cost_per_recipe_unit = self.raw_material.cost_per_unit / conversion.multiplier
            return self.quantity * cost_per_recipe_unit
        except UnitConversion.DoesNotExist:
            return 0 # Or handle via exception/validation

class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=150)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
