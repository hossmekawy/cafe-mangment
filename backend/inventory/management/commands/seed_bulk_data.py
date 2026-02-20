import random
import decimal
import datetime
from django.core.management.base import BaseCommand
from django.utils import timezone
from authentication.models import Branch
from inventory.models import Unit, StorageLocation, RawMaterial, StockMovement, StockBatch
from purchasing.models import Supplier


class Command(BaseCommand):
    help = 'Seeds the database with approximately 100,000 rows to stress-test SQLite performance'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING("🚀 Starting bulk data generation..."))

        # ──────────────────────────── 1. Core Lookup Data ────────────────────────────
        self.stdout.write("  [1/5] Generating Core Configuration (Units, Branches, Locations)...")
        units_data = [
            ('Kilogram', 'kg'), ('Liter', 'liter'), ('Gram', 'gram'),
            ('Milliliter', 'ml'), ('Piece', 'piece'), ('Box', 'box'),
            ('Sack', 'sack'), ('Bottle', 'bottle'), ('Can', 'can'), ('Pack', 'pack'),
        ]
        units = []
        for name, abbr in units_data:
            unit, _ = Unit.objects.get_or_create(name=name, abbreviation=abbr)
            units.append(unit)

        default_branch, _ = Branch.objects.get_or_create(name="Main Hub", defaults={'is_active': True})

        locations = []
        for loc_name in ['Main Fridge', 'Dry Storage A', 'Dry Storage B', 'Freezer 1', 'Bar Counter']:
            loc, _ = StorageLocation.objects.get_or_create(name=loc_name, branch=default_branch)
            locations.append(loc)

        # ──────────────────────────── 2. Suppliers (200) ─────────────────────────────
        self.stdout.write("  [2/5] Generating 200 Suppliers...")
        existing_supplier_count = Supplier.objects.count()
        suppliers_to_create = []
        for i in range(existing_supplier_count, existing_supplier_count + 200):
            suppliers_to_create.append(Supplier(
                name=f"Bulk Supplier Corp #{i}",
                contact_person=f"Agent {i}",
                email=f"bulk_supplier_{i}@example.com",
                phone=f"+1-555-{random.randint(1000000, 9999999)}"
            ))
        Supplier.objects.bulk_create(suppliers_to_create, ignore_conflicts=True)
        suppliers = list(Supplier.objects.all())
        self.stdout.write(f"       Total suppliers in DB: {len(suppliers)}")

        # ──────────────────────────── 3. Raw Materials (1,000) ───────────────────────
        self.stdout.write("  [3/5] Generating 1,000 Raw Materials...")
        existing_mat_count = RawMaterial.objects.count()
        categories = ['dairy', 'dry_goods', 'fresh_produce', 'beverages', 'packaging', 'cleaning', 'other']
        materials_to_create = []
        for i in range(existing_mat_count, existing_mat_count + 1000):
            materials_to_create.append(RawMaterial(
                name=f"Bulk Material {i:04d}",
                category=random.choice(categories),
                unit=random.choice(units),
                current_stock=decimal.Decimal(str(round(random.uniform(0.0, 500.0), 3))),
                minimum_stock=decimal.Decimal(str(round(random.uniform(5.0, 50.0), 3))),
                reorder_quantity=decimal.Decimal(str(round(random.uniform(10.0, 100.0), 3))),
                cost_per_unit=decimal.Decimal(str(round(random.uniform(0.5, 25.0), 2))),
                storage_location=random.choice(locations),
                preferred_supplier=random.choice(suppliers) if random.random() > 0.3 else None,
            ))
        RawMaterial.objects.bulk_create(materials_to_create, ignore_conflicts=True)
        materials = list(RawMaterial.objects.all())
        self.stdout.write(f"       Total materials in DB: {len(materials)}")

        # ──────────────────────────── 4. Stock Movements (~95,000) ────────────────────
        self.stdout.write("  [4/5] Generating ~95,000 Stock Movements (in chunks of 5,000)...")
        chunk_size = 5000
        target_movements = 95000
        movements_created = 0
        movement_types = ['purchase', 'consumption', 'manual_adjustment', 'waste', 'physical_count']
        now = timezone.now()

        while movements_created < target_movements:
            batch = []
            remaining = min(chunk_size, target_movements - movements_created)

            for _ in range(remaining):
                material = random.choice(materials)
                current = float(material.current_stock)
                qty_val = round(random.uniform(1.0, 80.0), 3)
                m_type = random.choice(movement_types)

                if m_type in ('waste', 'consumption'):
                    qty = decimal.Decimal(str(-abs(qty_val)))
                else:
                    qty = decimal.Decimal(str(abs(qty_val)))

                q_before = decimal.Decimal(str(round(current, 3)))
                q_after = q_before + qty

                batch.append(StockMovement(
                    raw_material=material,
                    movement_type=m_type,
                    quantity=qty,
                    quantity_before=q_before,
                    quantity_after=q_after,
                    note=f"Bulk seeded movement",
                ))

            StockMovement.objects.bulk_create(batch)
            movements_created += remaining
            self.stdout.write(f"       ... inserted {movements_created:,}/{target_movements:,} movements")

        # ──────────────────────── 5. Stock Batches (~5,000) ─────────────────────────
        self.stdout.write("  [5/5] Generating ~5,000 Stock Batches...")
        batches_to_create = []
        for _ in range(5000):
            material = random.choice(materials)
            batches_to_create.append(StockBatch(
                raw_material=material,
                quantity=decimal.Decimal(str(round(random.uniform(5.0, 200.0), 3))),
                cost_per_unit=material.cost_per_unit,
                expiry_date=(now + datetime.timedelta(days=random.randint(30, 365))).date(),
            ))
        StockBatch.objects.bulk_create(batches_to_create)

        # ─────────────────────────── Summary ─────────────────────────────────────────
        total_rows = (
            Unit.objects.count()
            + StorageLocation.objects.count()
            + Supplier.objects.count()
            + RawMaterial.objects.count()
            + StockMovement.objects.count()
            + StockBatch.objects.count()
        )
        self.stdout.write(self.style.SUCCESS(
            f"\n✅  Done! Total rows across seeded tables: {total_rows:,}"
        ))
