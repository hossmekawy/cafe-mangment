from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from inventory.models import StockBatch, Notification

class Command(BaseCommand):
    help = 'Checks for StockBatches expiring within 7 days and issues Notifications'

    def handle(self, *args, **kwargs):
        threshold_date = timezone.now().date() + timedelta(days=7)
        
        # Un-depleted batches expiring soon
        expiring_batches = StockBatch.objects.filter(
            is_depleted=False,
            expiry_date__lte=threshold_date,
            expiry_date__gte=timezone.now().date()
        )
        
        count = 0
        for batch in expiring_batches:
            title = f"Expiring Soon: {batch.raw_material.name}"
            msg = f"Batch {batch.id.hex[:6]} of {batch.quantity} {batch.raw_material.unit.abbreviation} expires on {batch.expiry_date}."
            
            # Don't spam notifications if one already exists for this batch
            exists = Notification.objects.filter(title=title, message=msg, is_read=False).exists()
            if not exists:
                Notification.objects.create(title=title, message=msg)
                count += 1
                
        # Also check batches that are ALREADY EXPIRED but still not marked depleted
        expired_batches = StockBatch.objects.filter(
            is_depleted=False,
            expiry_date__lt=timezone.now().date()
        )
        
        for batch in expired_batches:
            title = f"CRITICAL: EXPIRED STOCK - {batch.raw_material.name}"
            msg = f"Batch {batch.id.hex[:6]} expired on {batch.expiry_date}! Please dispose and log waste."
            exists = Notification.objects.filter(title=title, message=msg, is_read=False).exists()
            if not exists:
                Notification.objects.create(title=title, message=msg)
                count += 1
                
        self.stdout.write(self.style.SUCCESS(f'Successfully created {count} expiry notifications.'))
