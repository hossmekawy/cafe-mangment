from django.db import models
from django.core.exceptions import ValidationError

class GlobalSettings(models.Model):
    # Brand Info
    brand_name = models.CharField(max_length=255, default='waitless')
    brand_phone = models.CharField(max_length=20, default='01099641402')
    logo_base64 = models.TextField(blank=True, null=True, help_text="Base64 encoded string for branding")
    social_link = models.URLField(blank=True, null=True, help_text="Single URL for QR generation (e.g. Linktree)")
    address = models.TextField(blank=True, null=True, help_text="Physical branch address for receipts")
    
    # Financial Info
    currency = models.CharField(max_length=10, default='EGP')
    tax_label = models.CharField(max_length=50, default='VAT', help_text="Label for taxes on receipts")
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=14.00, help_text="Tax as a percentage (e.g., 14.00)")
    service_charge_rate = models.DecimalField(max_digits=5, decimal_places=2, default=12.00, help_text="Service charge as a percentage")
    tax_inclusive = models.BooleanField(default=False, help_text="Is VAT included in menu prices?")
    
    # POS & Printing Info
    enable_tips = models.BooleanField(default=True, help_text="Prompt for tips on POS?")
    wifi_password = models.CharField(max_length=50, blank=True, null=True, help_text="Optional Wi-Fi password for receipts")
    
    RECEIPT_PRINTER_CHOICES = [
        ('thermal80', 'Thermal 80mm'),
        ('thermal72', 'Thermal 72mm'),
        ('a4', 'Standard A4'),
        ('a5', 'Standard A5'),
    ]
    receipt_printer_type = models.CharField(max_length=20, choices=RECEIPT_PRINTER_CHOICES, default='thermal80')
    
    LANGUAGE_CHOICES = [
        ('en', 'English'),
        ('ar', 'Arabic'),
    ]
    default_language = models.CharField(max_length=5, choices=LANGUAGE_CHOICES, default='en')
    receipt_language = models.CharField(max_length=5, choices=LANGUAGE_CHOICES, default='en')
    
    receipt_header_msg = models.TextField(blank=True, null=True, help_text="Message at the top of the printed receipt")
    receipt_footer_msg = models.TextField(default="Thank you for visiting waitless!", help_text="Message at the bottom of the printed receipt")
    
    # System Info
    operating_hours = models.TextField(blank=True, null=True, help_text="JSON or text string representing operating hours")

    class Meta:
        verbose_name = 'Global Setting'
        verbose_name_plural = 'Global Settings'

    def save(self, *args, **kwargs):
        if not self.pk and GlobalSettings.objects.exists():
            # If you try to create a new one, but one already exists, raise error
            raise ValidationError('There can only be one GlobalSettings instance')
        return super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        # Fetch the singleton, or create it if it doesn't exist
        obj, created = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f"{self.brand_name} Settings"


class OrderCancelReason(models.Model):
    """Configurable cancel reasons for orders that appear in the POS cancel modal."""
    label = models.CharField(max_length=150)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['label']
        verbose_name = 'Order Cancel Reason'
        verbose_name_plural = 'Order Cancel Reasons'

    def __str__(self):
        return self.label
