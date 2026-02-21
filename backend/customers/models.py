import uuid
from django.db import models
from django.conf import settings

class TierDefinition(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50, unique=True) # e.g., Regular, Silver, Gold
    required_points = models.IntegerField(default=0) # Lifetime points required to reach this tier
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00) # Optional perk
    color_code = models.CharField(max_length=20, default='#cbd5e1') # For UI Badging

    def __str__(self):
        return f"{self.name} (Requires {self.required_points} pts)"

class Customer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    phone = models.CharField(max_length=20, unique=True, db_index=True) # Primary lookup at POS
    email = models.EmailField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    marketing_consent = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name or ''} ({self.phone})"

class CustomerPreference(models.Model):
    customer = models.OneToOneField(Customer, on_delete=models.CASCADE, related_name='preferences')
    allergies = models.TextField(blank=True, null=True, help_text="Comma separated or general notes")
    favorite_order_notes = models.TextField(blank=True, null=True, help_text="Waitstaff notes for quick ordering")
    general_notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Preferences for {self.customer}"

class CustomerTab(models.Model):
    customer = models.OneToOneField(Customer, on_delete=models.CASCADE, related_name='tab')
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0.00) # 0 means disabled
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"Tab: {self.customer} (Balance: {self.balance})"

class LoyaltyAccount(models.Model):
    customer = models.OneToOneField(Customer, on_delete=models.CASCADE, related_name='loyalty_account')
    points_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    lifetime_points = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    current_tier = models.ForeignKey(TierDefinition, on_delete=models.SET_NULL, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Loyalty: {self.customer} ({self.points_balance} pts)"
