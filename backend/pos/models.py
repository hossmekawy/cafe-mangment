import uuid
from django.db import models
from django.conf import settings
from inventory.models import Product

class ModifierGroup(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150) # e.g. "Milk Type", "Sugar Level", "Add-ons"
    min_choices = models.IntegerField(default=0)
    max_choices = models.IntegerField(default=1) # 0 means unlimited
    is_active = models.BooleanField(default=True)
    
    # Relationships
    products = models.ManyToManyField(Product, related_name='modifier_groups', blank=True)

    def __str__(self):
        return self.name

class Modifier(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(ModifierGroup, on_delete=models.CASCADE, related_name='modifiers')
    name = models.CharField(max_length=100) # e.g. "Oat Milk", "Extra Shot"
    extra_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} (+{self.extra_price})"

class Table(models.Model):
    STATUS_CHOICES = (
        ('available', 'Available'),
        ('occupied', 'Occupied'),
        ('reserved', 'Reserved'),
        ('needs_cleaning', 'Needs Cleaning'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    number = models.CharField(max_length=20, unique=True)
    capacity = models.IntegerField(default=4)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='available')
    
    # UX specific data for Visual Floor Plan
    position_x = models.IntegerField(default=0)
    position_y = models.IntegerField(default=0)
    
    def __str__(self):
        return f"Table {self.number}"

class Order(models.Model):
    TYPE_CHOICES = (
        ('dine_in', 'Dine-In'),
        ('takeaway', 'Takeaway'),
        ('delivery', 'Delivery'),
    )
    
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_number = models.CharField(max_length=50, unique=True, blank=True)
    shift = models.ForeignKey('finance.CashShift', on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    order_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='takeaway')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Financials
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    service_charge = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    
    # Context
    customer = models.ForeignKey('customers.Customer', on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    table = models.ForeignKey(Table, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    assigned_waiter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders_taken')
    is_paid = models.BooleanField(default=False)
    notes = models.TextField(blank=True, null=True)
    cancel_reason = models.TextField(blank=True, null=True, help_text="Reason provided when order was cancelled")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def save(self, *args, **kwargs):
        if not self.order_number:
            self._generate_order_number()
        super().save(*args, **kwargs)

    def _generate_order_number(self):
        """Generate order number as ShiftNumber/SequentialOrder (e.g. 5/001)."""
        from finance.models import CashShift
        from datetime import date

        # Try to find the open shift for the waiter/cashier
        open_shift = None
        if self.assigned_waiter:
            open_shift = CashShift.objects.filter(
                cashier=self.assigned_waiter, status='open'
            ).first()
        
        if not open_shift:
            # Fallback: any open shift on the same branch as the waiter
            if self.assigned_waiter and hasattr(self.assigned_waiter, 'branch') and self.assigned_waiter.branch:
                open_shift = CashShift.objects.filter(
                    branch=self.assigned_waiter.branch, status='open'
                ).first()

        if open_shift:
            self.shift = open_shift
            # Count existing orders in this shift
            order_seq = Order.objects.filter(shift=open_shift).count() + 1
            self.order_number = f"{open_shift.shift_number}/{order_seq:03d}"
        else:
            # Fallback for when there is no open shift
            today = date.today()
            day_count = Order.objects.filter(created_at__date=today).count() + 1
            self.order_number = f"0/{day_count:03d}"

    def __str__(self):
        return f"{self.order_number}"

class OrderItem(models.Model):
    STATION_CHOICES = (
        ('bar', 'Coffee Bar'),
        ('kitchen', 'Kitchen'),
        ('dessert', 'Dessert Station'),
    )
    
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('preparing', 'Preparing'),
        ('ready', 'Ready'),
        ('served', 'Served'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.IntegerField(default=1)
    
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=10, decimal_places=2) # quantity * unit_price + modifiers
    
    modifiers = models.ManyToManyField(Modifier, blank=True)
    special_instructions = models.TextField(blank=True, null=True)
    
    prep_station = models.CharField(max_length=20, choices=STATION_CHOICES, default='bar')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    created_at = models.DateTimeField(auto_now_add=True)
    ready_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.quantity}x {self.product.name} (Order {self.order.order_number})"

class Payment(models.Model):
    METHOD_CHOICES = (
        ('cash', 'Cash'),
        ('card', 'Credit/Debit Card'),
        ('fawry', 'Fawry'),
        ('instapay', 'InstaPay'),
        ('vodafone_cash', 'Vodafone Cash'),
        ('tab', 'Customer Tab'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=30, choices=METHOD_CHOICES)
    
    transaction_reference = models.CharField(max_length=100, blank=True, null=True)
    processed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.amount} via {self.payment_method} for {self.order.order_number}"
