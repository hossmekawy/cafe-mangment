import uuid
from decimal import Decimal
from django.utils import timezone
from .models import RawMaterial, StockBatch, StockMovement, WasteLog, Notification

def log_stock_movement(raw_material, movement_type, quantity, performed_by=None, note="", grn=None, waste_log=None):
    """
    Centralized function to log stock movements and update the raw material's current_stock.
    Quantity should be positive for INwards (purchase, transfer in)
    and negative for OUTwards (consumption, waste).
    """
    quantity = Decimal(quantity)
    
    # Snapshot before change
    qty_before = raw_material.current_stock
    qty_after = qty_before + quantity
    
    # Update actual material stock
    raw_material.current_stock = qty_after
    raw_material.save()
    
    # Create the audit log
    movement = StockMovement.objects.create(
        raw_material=raw_material,
        movement_type=movement_type,
        quantity=quantity,
        quantity_before=qty_before,
        quantity_after=qty_after,
        grn=grn,
        waste_log=waste_log,
        note=note,
        performed_by=performed_by
    )
    
    # Trigger low stock check
    check_low_stock(raw_material)
    
    return movement

def check_low_stock(raw_material):
    """
    Checks if a material fell below its minimum_stock threshold,
    and creates a notification if it did.
    """
    if raw_material.current_stock <= raw_material.minimum_stock:
        # Check if we already have an unread notification for this material to avoid spam
        notif_exists = Notification.objects.filter(
            title__icontains=raw_material.name,
            is_read=False,
            title__startswith="Low Stock Alert"
        ).exists()
        
        if not notif_exists:
            Notification.objects.create(
                title=f"Low Stock Alert: {raw_material.name}",
                message=f"{raw_material.name} has dropped to {raw_material.current_stock} {raw_material.unit.abbreviation}. Minimum threshold is {raw_material.minimum_stock}."
            )

def deduct_stock_for_waste(raw_material, quantity, reason, logged_by=None, note=""):
    """
    Specialized service for handling waste logging.
    Calculates cost value and logs the negative movement.
    """
    quantity = Decimal(quantity)
    # The cost value is derived from the latest cost_per_unit
    cost_value = quantity * raw_material.cost_per_unit
    
    waste = WasteLog.objects.create(
        raw_material=raw_material,
        quantity=quantity,
        reason=reason,
        cost_value=cost_value,
        note=note,
        logged_by=logged_by
    )
    
    # Deduct stock (negative quantity)
    log_stock_movement(
        raw_material=raw_material,
        movement_type='waste',
        quantity=-quantity,
        performed_by=logged_by,
        note=f"Waste: {reason}",
        waste_log=waste
    )
    
    return waste

def reconcile_physical_count(physical_count):
    """
    Finalizes a physical count by looping through its items and applying discrepancies
    as 'manual_adjustment' stock movements.
    """
    from django.db import transaction
    
    if physical_count.status == 'completed':
        raise ValueError("This physical count is already completed.")
        
    with transaction.atomic():
        for item in physical_count.items.all():
            if item.discrepancy != 0:
                # Discrepancy can be positive (found more) or negative (found less)
                log_stock_movement(
                    raw_material=item.raw_material,
                    movement_type='manual_adjustment',
                    quantity=item.discrepancy,  
                    performed_by=physical_count.completed_by,
                    note=f"Physical Count Reconciliation (Count ID: {physical_count.id})"
                )
        
        physical_count.status = 'completed'
        physical_count.completed_at = timezone.now()
        physical_count.save()

def deduct_recipe_ingredients(recipe, quantity, user, reference_order=None, note_prefix=""):
    """
    Executes the stock deduction logic for a specific Recipe object.
    Helper method to allow abstract deductions for Base Products, Variations, and Modifiers.
    """
    if not recipe:
        return True, "No recipe found; nothing to deduct."
        
    for ingredient in recipe.ingredients.all():
        raw_material = ingredient.raw_material
        
        # Calculate how much of the raw material we need in the raw material's base unit
        # Formula: Required Base Qty = (Ingredient Qty * Recipe Yield Qty * Order Qty) * Conversion Multiplier
        needed_qty = ingredient.quantity * Decimal(quantity) / recipe.yield_quantity
        
        if ingredient.unit != raw_material.unit:
            from .models import UnitConversion
            try:
                conversion = UnitConversion.objects.get(
                    from_unit=raw_material.unit,
                    to_unit=ingredient.unit
                )
                needed_qty = needed_qty / conversion.multiplier
            except UnitConversion.DoesNotExist:
                return False, f"Missing Unit Conversion: Cannot convert {raw_material.unit} to {ingredient.unit}"
                
        movement_note = f"Consumed {quantity}x {note_prefix}"
        if reference_order:
            movement_note += f" (Order: {reference_order.order_number})"
            
        log_stock_movement(
            raw_material=raw_material,
            movement_type='consumption',
            quantity=-needed_qty,
            performed_by=user,
            note=movement_note
        )
        
    return True, ""


def deduct_stock(product, quantity, user, reference_order=None, variation=None):
    """
    Deducts raw materials based on a product's base or variation recipe.
    Returns (True, "") on success, or (False, "error message") on failure.
    """
    # 1. Determine which base recipe to use
    recipe = None
    if variation and hasattr(variation, 'recipe') and variation.recipe.exists():
        recipe = variation.recipe.first()
    elif hasattr(product, 'recipes') and product.recipes.exists():
        recipe = product.recipes.first()
    elif hasattr(product, 'recipe') and product.recipe:
        recipe = product.recipe

    if not recipe:
        return True, "No recipe found; nothing to deduct."
    
    # 2. Deduct the base recipe
    note = f"[{product.name}"
    if variation:
        note += f" - {variation.size_name}"
    note += "]"
    
    return deduct_recipe_ingredients(
        recipe=recipe, 
        quantity=quantity, 
        user=user, 
        reference_order=reference_order,
        note_prefix=note
    )
        


def calculate_inventory_value():
    """Returns the total estimated value of current stock."""
    from django.db.models import F, Sum
    result = RawMaterial.objects.filter(is_active=True).aggregate(
        total_value=Sum(F('current_stock') * F('cost_per_unit'))
    )
    return result['total_value'] or Decimal('0.00')
