"""Signal to auto-create a SalesTransaction when a POS Payment is created."""
from django.db.models.signals import post_save
from django.dispatch import receiver
from pos.models import Payment


@receiver(post_save, sender=Payment)
def create_sales_transaction(sender, instance, created, **kwargs):
    if not created:
        return

    from .models import SalesTransaction, CashShift

    order = instance.order

    # Try to find the cashier's open shift
    shift = CashShift.objects.filter(
        cashier=instance.processed_by,
        status='open',
    ).first() if instance.processed_by else None

    SalesTransaction.objects.create(
        transaction_type='sale',
        order=order,
        payment=instance,
        shift=shift,
        gross_amount=order.total_amount,
        tax_amount=order.tax_amount,
        service_charge=order.service_charge,
        discount_amount=order.discount_amount,
        net_amount=instance.amount,
        payment_method=instance.payment_method,
        cashier=instance.processed_by,
    )
