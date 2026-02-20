import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from inventory.models import Unit, StorageLocation
from authentication.models import Branch

# Default Branch
branch, created = Branch.objects.get_or_create(
    name="Main Branch",
    defaults={'address': 'Headquarters'}
)

print(f"Main Branch ready: {branch.name}")

# Units
units = [
    ('Kilogram', 'kg'),
    ('Gram', 'g'),
    ('Liter', 'L'),
    ('Milliliter', 'ml'),
    ('Piece', 'pc'),
    ('Box', 'box'),
    ('Bag', 'bag'),
]

for name, abbr in units:
    Unit.objects.get_or_create(name=name, abbreviation=abbr)

print("Units seeded.")

# Storage Locations
locations = [
    ('Main Fridge', 'Walk-in refrigerator for perishables'),
    ('Dry Storage', 'Shelves for non-perishable goods'),
    ('Bar Counter', 'Front-of-house espresso and beverage prep area'),
    ('Freezer', 'Deep freeze storage'),
]

for name, desc in locations:
    StorageLocation.objects.get_or_create(
        name=name, 
        branch=branch, 
        defaults={'description': desc}
    )

print("Storage Locations seeded.")
