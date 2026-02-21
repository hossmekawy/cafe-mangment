import uuid
from django.db import models
from django.conf import settings
from customers.models import Customer
from inventory.models import MenuCategory, Product

class LoyaltyRule(models.Model):
    """Engine for Earning Points"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100) # e.g. "Standard Earning"
    spend_amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="Amount to spend") # e.g. 1.00 EGP
    points_earned = models.DecimalField(max_digits=10, decimal_places=2, help_text="Points earned per spend_amount") # e.g. 0.5 points
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name}: {self.spend_amount} EGP = {self.points_earned} pts"

class Reward(models.Model):
    """Engine for Burning Points"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150) # e.g. "50 EGP Off", "Free Coffee"
    points_cost = models.IntegerField(help_text="Points required to redeem")
    
    # Types of rewards
    discount_value = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Direct money off")
    is_percentage = models.BooleanField(default=False)
    free_product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.points_cost} pts)"

class Campaign(models.Model):
    """Time-based logic e.g., Happy Hour"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, null=True)
    
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)
    
    # Targeting
    target_category = models.ForeignKey(MenuCategory, on_delete=models.SET_NULL, null=True, blank=True)
    target_product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Effect
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

class Coupon(models.Model):
    """Unique voucher codes"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True, db_index=True)
    
    discount_value = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    is_percentage = models.BooleanField(default=False)
    
    usage_limit = models.IntegerField(default=1, help_text="0 for unlimited")
    times_used = models.IntegerField(default=0)
    
    expiry_date = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def is_valid(self):
        import django.utils.timezone as timezone
        if not self.is_active: return False
        if self.usage_limit > 0 and self.times_used >= self.usage_limit: return False
        if self.expiry_date and timezone.now() > self.expiry_date: return False
        return True

    def __str__(self):
        return self.code

class Referral(models.Model):
    """Tracks customer-to-customer referrals"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    referrer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='referrals_made')
    referred_phone = models.CharField(max_length=20)
    status = models.CharField(max_length=20, choices=(('pending', 'Pending (No purchase yet)'), ('completed', 'Completed')), default='pending')
    
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.referrer.phone} referred {self.referred_phone}"
