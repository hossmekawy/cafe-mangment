import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from inventory.models import Unit, StorageLocation, RawMaterial, StockBatch, StockMovement
from purchasing.models import Supplier, PurchaseOrder, PurchaseOrderItem, GoodsReceivedNote, GRNItem, SupplierInvoice
from purchasing.services import complete_grn
from django.contrib.auth import get_user_model

User = get_user_model()
admin = User.objects.filter(is_superuser=True).first()
if not admin:
    admin = User.objects.create_superuser('testadmin', 'test@test.com', 'adminpass')
    print("Created test admin.")

# 1. Setup Data
kg = Unit.objects.get(abbreviation='kg')
loc = StorageLocation.objects.first()
supplier, _ = Supplier.objects.get_or_create(name='Global Coffee Dist', phone='555-0199')

coffee_beans, created = RawMaterial.objects.get_or_create(
    name='Premium Arabica Beans',
    defaults={
        'category': 'dry_goods',
        'unit': kg,
        'minimum_stock': Decimal('5.000'),
        'current_stock': Decimal('0.000'),
        'cost_per_unit': Decimal('15.00'),
        'storage_location': loc,
        'preferred_supplier': supplier
    }
)

if not created:
    coffee_beans.current_stock = Decimal('0.000')
    coffee_beans.save()
    StockBatch.objects.filter(raw_material=coffee_beans).delete()
    StockMovement.objects.filter(raw_material=coffee_beans).delete()
    GoodsReceivedNote.objects.all().delete()
    PurchaseOrder.objects.all().delete()
    SupplierInvoice.objects.all().delete()

print(f"Initial Stock for {coffee_beans.name}: {coffee_beans.current_stock}")

# 2. Create Purchase Order
po = PurchaseOrder.objects.create(
    po_number='PO-TEST-001',
    supplier=supplier,
    status='confirmed',
    created_by=admin
)

po_item = PurchaseOrderItem.objects.create(
    purchase_order=po,
    raw_material=coffee_beans,
    quantity_ordered=Decimal('50.000'),
    unit_price=Decimal('14.50')
)

print(f"PO {po.po_number} created for 50kg.")

# 3. Create GRN
grn = GoodsReceivedNote.objects.create(
    grn_number='GRN-TEST-001',
    purchase_order=po,
    supplier=supplier,
    received_by=admin
)

grn_item = GRNItem.objects.create(
    grn=grn,
    raw_material=coffee_beans,
    quantity_ordered=Decimal('50.000'),
    quantity_received=Decimal('50.000'),
    unit_price=Decimal('14.50')
)

print(f"GRN {grn.grn_number} created.")

# 4. Finalize GRN (The magical transaction!)
try:
    complete_grn(grn.id, admin)
    print("GRN Completed Successfully via Service!")
except Exception as e:
    print("FAILED TO COMPLETE GRN:", str(e))

# 5. ASSERTS & VERIFICATION
coffee_beans.refresh_from_db()
po.refresh_from_db()

print(f"Final Stock: {coffee_beans.current_stock} (Should be 50.000)")
print(f"New Unit Cost: {coffee_beans.cost_per_unit} (Should be 14.50)")
print(f"PO Status: {po.status} (Should be received)")

batch = StockBatch.objects.filter(grn=grn).first()
print(f"Stock Batch Created: {batch is not None} (Qty: {batch.quantity if batch else 'N/A'})")

movement = StockMovement.objects.filter(grn=grn).first()
print(f"Stock Movement Logged: {movement is not None} (Qty: {movement.quantity if movement else 'N/A'})")

invoice = SupplierInvoice.objects.filter(grn=grn).first()
print(f"Auto-generated Invoice: {invoice is not None} (Amount: {invoice.total_amount if invoice else 'N/A'})")

