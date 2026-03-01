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
        from django.db.models import Q

        # 1. Try to find shift for the assigned waiter (either as host or collaborator)
        open_shift = None
        if self.assigned_waiter:
            open_shift = CashShift.objects.filter(
                Q(cashier=self.assigned_waiter) | Q(assigned_users=self.assigned_waiter),
                status='open'
            ).distinct().first()
        
        # 2. If not found, look for any open shift in the same branch
        if not open_shift:
            # Determine branch: from waiter, or from current context if we had one
            # For robustness, we search for any open shift in the branch
            branch_id = None
            if self.assigned_waiter and hasattr(self.assigned_waiter, 'branch'):
                branch_id = self.assigned_waiter.branch_id
            
            # If still no branch, just take the first open shift available (fallback)
            if branch_id:
                open_shift = CashShift.objects.filter(branch_id=branch_id, status='open').first()
            else:
                open_shift = CashShift.objects.filter(status='open').first()

        if open_shift:
            self.shift = open_shift
            order_seq = Order.objects.filter(shift=open_shift).count() + 1
            base_number = f"{open_shift.shift_number}/{order_seq:03d}"
        else:
            today = date.today()
            day_count = Order.objects.filter(created_at__date=today).count() + 1
            base_number = f"0-{today.strftime('%y%m%d')}/{day_count:03d}"
            
        # Ensure uniqueness
        final_number = base_number
        counter = 1
        while Order.objects.filter(order_number=final_number).exists():
            final_number = f"{base_number}-{counter}"
            counter += 1
            
        self.order_number = final_number

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
    variation = models.ForeignKey('inventory.ProductVariation', null=True, blank=True, on_delete=models.SET_NULL, help_text="Specific flavor/size if applicable")
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
