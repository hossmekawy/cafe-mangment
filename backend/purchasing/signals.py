from django.db.models.signals import pre_save
from django.dispatch import receiver
from .models import SupplierMaterial, PriceHistory

@receiver(pre_save, sender=SupplierMaterial)
def log_price_history(sender, instance, **kwargs):
    """
    If a SupplierMaterial is being updated and its unit_price has changed,
    log the new price automatically into PriceHistory.
    """
    if instance.id: # only if it exists (not on first creation)
        try:
            old_instance = SupplierMaterial.objects.get(id=instance.id)
            if old_instance.unit_price != instance.unit_price:
                # Need to use a post_save here or just create it now if we don't care about the DB ID
                PriceHistory.objects.create(
                    supplier_material=instance,
                    price=instance.unit_price
                )
        except SupplierMaterial.DoesNotExist:
            pass
