from decimal import Decimal
from django.db import transaction
from .models import Order
from inventory.services import deduct_stock

def process_customer_loyalty_and_tab(order):
    if not order.customer:
        return

    # Handle Tab Payment (Adds to their debt payload)
    from customers.models import CustomerTab, TierDefinition
    from promotions.models import LoyaltyRule
    
    tab_payments = order.payments.filter(payment_method='tab')
    if tab_payments.exists():
        customer_tab = getattr(order.customer, 'tab', None)
        if customer_tab:
            for payment in tab_payments:
                customer_tab.balance += payment.amount
            customer_tab.save()

    # Handle Loyalty Points Awarding
    active_rules = LoyaltyRule.objects.filter(is_active=True)
    
    total_points = Decimal('0.00')
    for rule in active_rules:
        if order.total_amount >= rule.spend_amount and rule.spend_amount > 0:
            multiplier = int(order.total_amount / rule.spend_amount)
            total_points += rule.points_earned * Decimal(str(multiplier))
            
    if total_points > 0:
        loyalty_acc = getattr(order.customer, 'loyalty_account', None)
        if loyalty_acc:
            loyalty_acc.points_balance += total_points
            loyalty_acc.lifetime_points += total_points
            
            # Check for Tier Upgrades
            eligible_tiers = TierDefinition.objects.filter(required_points__lte=loyalty_acc.lifetime_points).order_by('-required_points')
            if eligible_tiers.exists():
                new_tier = eligible_tiers.first()
                if loyalty_acc.current_tier != new_tier:
                    loyalty_acc.current_tier = new_tier
                    
            loyalty_acc.save()


def complete_order(order_id, user):
    """
    Called when an order is finalized (e.g. paid).
    Loops through all order items and deducts their recipe ingredients from inventory.
    Also handles Customer Loyalty and CRM Tab updates.
    """
    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        return False, "Order not found"
        
    if order.status == 'completed':
        return False, "Order is already completed"
        
    try:
        with transaction.atomic():
            # 1. Deduct Stock
            from inventory.services import log_stock_movement, deduct_recipe_ingredients
            for item in order.items.all():
                # Check for direct retail item first (e.g. Water, Cake)
                if item.product.linked_raw_material:
                    log_stock_movement(
                        raw_material=item.product.linked_raw_material,
                        movement_type='consumption',
                        quantity=-item.quantity,
                        performed_by=user,
                        note=f"Consumed for {item.quantity}x {item.product.name} (Direct Retail) (Order: {order.order_number})"
                    )
                # Fallback to Recipe deduction for prepared items
                else:
                    success, message = deduct_stock(
                        product=item.product,
                        quantity=item.quantity,
                        user=user,
                        reference_order=order,
                        variation=item.variation
                    )
                    
                    if not success:
                        raise Exception(f"Failed to deduct stock for {item.product.name}: {message}")
                        
                # 3. Deduct stock for Modifiers explicitly attached to the order item
                for modifier in item.modifiers.all():
                    if hasattr(modifier, 'recipe') and modifier.recipe.exists():
                        mod_recipe = modifier.recipe.first()
                        succ, msg = deduct_recipe_ingredients(
                            recipe=mod_recipe,
                            quantity=item.quantity, # E.g., 2 Lattes = 2x Extra Shots
                            user=user,
                            reference_order=order,
                            note_prefix=f"[Modifier: {modifier.name}]"
                        )
                        if not succ:
                            raise Exception(f"Failed to deduct stock for Modifier {modifier.name}: {msg}")
            
            # 2. Process CRM Loyalty & Tab
            process_customer_loyalty_and_tab(order)
            
            # 3. Mark as Completed
            order.status = 'completed'
            order.save()
            return True, "Order completed and stock deducted successfully"
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return False, str(e)
