import uuid
from django.db import models
from django.conf import settings

class Supplier(models.Model):
    PAYMENT_TERMS = (
        ('cash', 'Cash'),
        ('net_7', 'Net 7 Days'),
        ('net_15', 'Net 15 Days'),
        ('net_30', 'Net 30 Days'),
        ('credit', 'Credit'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    contact_person = models.CharField(max_length=150, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    
    payment_terms = models.CharField(max_length=20, choices=PAYMENT_TERMS, default='cash')
    delivery_days = models.JSONField(blank=True, null=True, help_text='e.g. ["Monday", "Thursday"]')
    
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=5.00)
    notes = models.TextField(blank=True, null=True)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class SupplierMaterial(models.Model):
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='materials_provided')
    raw_material = models.ForeignKey('inventory.RawMaterial', on_delete=models.CASCADE)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    is_preferred = models.BooleanField(default=False)
    lead_time_days = models.IntegerField(default=1)
    minimum_order_quantity = models.DecimalField(max_digits=10, decimal_places=3, default=1.0)

class PriceHistory(models.Model):
    supplier_material = models.ForeignKey(SupplierMaterial, on_delete=models.CASCADE, related_name='price_history')
    price = models.DecimalField(max_digits=10, decimal_places=2)
    effective_date = models.DateTimeField(auto_now_add=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)

class PurchaseOrderTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE)
    items = models.JSONField(help_text="Format: [{'material_id': uuid, 'qty': 10}]")
    is_active = models.BooleanField(default=True)

class PurchaseOrder(models.Model):
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('sent', 'Sent to Supplier'),
        ('confirmed', 'Confirmed'),
        ('partially_received', 'Partially Received'),
        ('received', 'Received'),
        ('cancelled', 'Cancelled'),
    )
    RECURRENCE_CHOICES = (
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('biweekly', 'Bi-Weekly'),
        ('monthly', 'Monthly'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    po_number = models.CharField(max_length=50, unique=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    
    order_date = models.DateField(auto_now_add=True)
    expected_delivery_date = models.DateField(null=True, blank=True)
    
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    
    is_recurring = models.BooleanField(default=False)
    recurrence_interval = models.CharField(max_length=20, choices=RECURRENCE_CHOICES, null=True, blank=True)
    next_recurrence_date = models.DateField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class PurchaseOrderItem(models.Model):
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='items')
    raw_material = models.ForeignKey('inventory.RawMaterial', on_delete=models.PROTECT)
    quantity_ordered = models.DecimalField(max_digits=10, decimal_places=3)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    quantity_received = models.DecimalField(max_digits=10, decimal_places=3, default=0.000)

class GoodsReceivedNote(models.Model):
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('completed', 'Completed'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    grn_number = models.CharField(max_length=50, unique=True)
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='grns')
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT)
    
    received_date = models.DateField(auto_now_add=True)
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    notes = models.TextField(blank=True, null=True)

class GRNItem(models.Model):
    grn = models.ForeignKey(GoodsReceivedNote, on_delete=models.CASCADE, related_name='items')
    raw_material = models.ForeignKey('inventory.RawMaterial', on_delete=models.PROTECT)
    quantity_ordered = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    quantity_received = models.DecimalField(max_digits=10, decimal_places=3)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    expiry_date = models.DateField(null=True, blank=True)
    discrepancy_note = models.TextField(blank=True, null=True)

class SupplierInvoice(models.Model):
    STATUS_CHOICES = (
        ('unpaid', 'Unpaid'),
        ('partially_paid', 'Partially Paid'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice_number = models.CharField(max_length=100)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT)
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True)
    grn = models.ForeignKey(GoodsReceivedNote, on_delete=models.SET_NULL, null=True, blank=True)
    
    invoice_date = models.DateField()
    due_date = models.DateField()
    
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='unpaid')
    notes = models.TextField(blank=True, null=True)

class SupplierPayment(models.Model):
    PAYMENT_METHODS = (
        ('cash', 'Cash'),
        ('bank_transfer', 'Bank Transfer'),
        ('check', 'Check'),
        ('instapay', 'InstaPay'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(SupplierInvoice, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_date = models.DateField(auto_now_add=True)
    payment_method = models.CharField(max_length=30, choices=PAYMENT_METHODS)
    reference_number = models.CharField(max_length=100, blank=True, null=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)

class SupplierPerformanceLog(models.Model):
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='performance_logs')
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE)
    expected_delivery_date = models.DateField()
    actual_delivery_date = models.DateField(null=True, blank=True)
    on_time = models.BooleanField(default=True)
    quality_rating = models.IntegerField(choices=[(i, i) for i in range(1, 6)], default=5)
    quantity_accuracy = models.BooleanField(default=True)
    notes = models.TextField(blank=True, null=True)
