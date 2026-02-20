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

class Recipe(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # menu_item = models.OneToOneField('sales.MenuItem', on_delete=models.CASCADE)
    # For now we'll put a charfield so migrations work, update this when sales app exists
    menu_item_name = models.CharField(max_length=150) 
    yield_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1.0)
    preparation_time = models.IntegerField(help_text="In minutes", default=5)
    notes = models.TextField(blank=True, null=True)

class RecipeIngredient(models.Model):
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name='ingredients')
    raw_material = models.ForeignKey(RawMaterial, on_delete=models.CASCADE)
    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT)
    is_optional = models.BooleanField(default=False)

class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=150)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
