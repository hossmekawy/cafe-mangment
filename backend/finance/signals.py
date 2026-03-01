"""Signal to auto-create a SalesTransaction when a POS Payment is created."""
from django.db.models.signals import post_save
from django.dispatch import receiver
from pos.models import Payment
from .models import Expense, CashMovement


@receiver(post_save, sender=Payment)
def create_sales_transaction(sender, instance, created, **kwargs):
    if not created:
        return

    from .models import SalesTransaction, CashShift, CashMovement

    order = instance.order
    shift = order.shift

    # 1. Create Sales Journal entry
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

    # 2. If Cash, create movement for shift discrepancy calculation
    if shift and instance.payment_method == 'cash':
        CashMovement.objects.create(
            shift=shift,
            movement_type='sale',
            amount=instance.amount,
            description=f"POS Sale: {order.order_number}",
            reference_order=order,
            performed_by=instance.processed_by,
        )

@receiver(post_save, sender=Expense)
def create_expense_movement(sender, instance, created, **kwargs):
    # Only for approved cash or petty_cash expenses
    if instance.status == 'approved' and instance.payment_method in ['cash', 'petty_cash']:
        if instance.shift:
            # Check if movement already exists to avoid duplication
            exists = CashMovement.objects.filter(
                shift=instance.shift,
                amount=instance.amount,
                movement_type='petty_cash',
                description__icontains=f"Expense: {instance.id}"
            ).exists()
            
            if not exists:
                CashMovement.objects.create(
                    shift=instance.shift,
                    movement_type='petty_cash',
                    amount=instance.amount,
                    description=f"Expense: {instance.description or 'No description'} (Ref: {instance.id})",
                    performed_by=instance.approved_by or instance.created_by,
                )
