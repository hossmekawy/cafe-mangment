from django.db import transaction
from django.utils import timezone
from .models import GoodsReceivedNote, SupplierInvoice
from inventory.models import StockBatch
# DANGER: We import from inventory.services ONLY. Do not import models here if we can avoid it.
from inventory.services import log_stock_movement

def complete_grn(grn_id, user):
    """
    Finalizes a Goods Received Note inside an atomic transaction.
    This is the core bridge between purchasing and inventory.
    """
    grn = GoodsReceivedNote.objects.get(id=grn_id)

    if grn.status == 'completed':
        raise ValueError("This GRN is already completed.")

    if not grn.items.exists():
        raise ValueError("Cannot complete a GRN with zero items.")

    with transaction.atomic():
        # Iterate over all GRN items
        for item in grn.items.all():
            if item.quantity_received <= 0:
                continue # Skip items that weren't actually received

            # 1. Update Inventory: Create a new StockBatch for FIFO/Expiry tracking
            batch = StockBatch.objects.create(
                raw_material=item.raw_material,
                quantity=item.quantity_received,
                cost_per_unit=item.unit_price,
                expiry_date=item.expiry_date,
                grn=grn
            )

            # 2. Update Inventory: Log the stock movement (which auto-adds to current_stock)
            log_stock_movement(
                raw_material=item.raw_material,
                movement_type='purchase',
                quantity=item.quantity_received,
                performed_by=user,
                note=f"Received via GRN: {grn.grn_number}",
                grn=grn
            )
            
            # 3. Update active cost of the material dynamically (moving average or latest depends on accounting rules)
            # For simpler cafe operations, usually last purchase price is accepted:
            item.raw_material.cost_per_unit = item.unit_price
            item.raw_material.save()

            # 4. If this GRN was from a PO, update the PO item quantities
            if grn.purchase_order:
                # Find matching PO item to update logic...
                po_item = grn.purchase_order.items.filter(raw_material=item.raw_material).first()
                if po_item:
                    po_item.quantity_received += item.quantity_received
                    po_item.save()

        # Update PO Status if all items are fully received
        total_invoice_amount = 0
        if grn.purchase_order:
            po = grn.purchase_order
            all_received = all(i.quantity_received >= i.quantity_ordered for i in po.items.all())
            po.status = 'received' if all_received else 'partially_received'
            po.save()
            
            # Calculate invoice amount based on what was actually received
            for item in grn.items.all():
                 total_invoice_amount += (item.quantity_received * item.unit_price)

        # 5. Auto-create a Draft SupplierInvoice
        # Calculate amount if there was no PO:
        if total_invoice_amount == 0:
             for item in grn.items.all():
                 total_invoice_amount += (item.quantity_received * item.unit_price)

        SupplierInvoice.objects.create(
            invoice_number=f"INV-AUTO-{grn.grn_number}",
            supplier=grn.supplier,
            purchase_order=grn.purchase_order,
            grn=grn,
            invoice_date=timezone.now().date(),
            due_date=timezone.now().date(), # Can calculate based on supplier terms later
            total_amount=total_invoice_amount,
            status='unpaid'
        )

        # Finally, mark GRN as completed
        grn.status = 'completed'
        # Prevent future modifications
        grn.save()
        
    return grn
