from django.db import models
from django.core.exceptions import ValidationError

class GlobalSettings(models.Model):
    # Brand Info
    brand_name = models.CharField(max_length=255, default='waitless')
    brand_phone = models.CharField(max_length=20, default='01099641402')
    logo_base64 = models.TextField(blank=True, null=True, help_text="Base64 encoded string for branding")
    social_link = models.URLField(blank=True, null=True, help_text="Single URL for QR generation (e.g. Linktree)")
    
    # Financial Info
    currency = models.CharField(max_length=10, default='EGP')
    vat_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=14.00, help_text="VAT as a percentage (e.g., 14.00)")
    service_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=12.00, help_text="Service charge as a percentage")
    tax_inclusive = models.BooleanField(default=False, help_text="Is VAT included in menu prices?")
    
    # POS & Printing Info
    enable_tips = models.BooleanField(default=True, help_text="Prompt for tips on POS?")
    address = models.TextField(blank=True, null=True, help_text="Physical branch address for receipts")
    wifi_password = models.CharField(max_length=50, blank=True, null=True, help_text="Optional Wi-Fi password for receipts")
    receipt_ending_message = models.TextField(default="Thank you for visiting waitless!", help_text="Message at the bottom of the printed receipt")

    class Meta:
        verbose_name = 'Global Setting'
        verbose_name_plural = 'Global Settings'

    def save(self, *args, **kwargs):
        if not self.pk and GlobalSettings.objects.exists():
            # If you try to create a new one, but one already exists, raise error
            raise ValidationError('There can only be one GlobalSettings instance')
        return super(GlobalSettings, self).save(*args, **kwargs)

    @classmethod
    def load(cls):
        # Fetch the singleton, or create it if it doesn't exist
        obj, created = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f"{self.brand_name} Settings"
