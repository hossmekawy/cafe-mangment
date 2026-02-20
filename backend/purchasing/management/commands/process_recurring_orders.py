from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from purchasing.models import PurchaseOrder, PurchaseOrderItem

class Command(BaseCommand):
    help = 'Processes recurring Purchase Orders whose next_recurrence_date is today or passed'

    def handle(self, *args, **kwargs):
        today = timezone.now().date()
        
        recurring_pos = PurchaseOrder.objects.filter(
            is_recurring=True,
            next_recurrence_date__lte=today
        )
        
        count = 0
        for original_po in recurring_pos:
            # 1. Spawn a new completely Draft clone of the PO
            new_po = PurchaseOrder.objects.create(
                po_number=f"{original_po.po_number}-AUTO-{today.strftime('%Y%m%d')}",
                supplier=original_po.supplier,
                status='draft',
                total_amount=original_po.total_amount,
                notes=f"Auto-generated from PO {original_po.po_number}",
                created_by=original_po.created_by
            )
            
            # 2. Clone the Items
            for item in original_po.items.all():
                PurchaseOrderItem.objects.create(
                    purchase_order=new_po,
                    raw_material=item.raw_material,
                    quantity_ordered=item.quantity_ordered,
                    unit_price=item.unit_price,
                    total_price=item.total_price
                )
                
            # 3. Calculate next recurrence date for the original PO
            interval = original_po.recurrence_interval
            if interval == 'daily':
                delta = timedelta(days=1)
            elif interval == 'weekly':
                delta = timedelta(days=7)
            elif interval == 'biweekly':
                delta = timedelta(days=14)
            elif interval == 'monthly':
                delta = timedelta(days=30)
            else:
                self.stdout.write(self.style.WARNING(f'PO {original_po.po_number} has no valid interval. Untoggling recurrence.'))
                original_po.is_recurring = False
                original_po.save()
                continue
                
            original_po.next_recurrence_date = today + delta
            original_po.save()
            count += 1
            
        self.stdout.write(self.style.SUCCESS(f'Successfully generated {count} recurring PO drafts.'))
