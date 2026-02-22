import os
import django
import sys

# Setup django environment
sys.path.append('/root/cafe-mangment/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from inventory.models import MenuCategory, Product
from django.db.models import Q

def test_pos_filter():
    try:
        # 1. Create a category intended to be hidden
        cat_hidden = MenuCategory.objects.create(name="Test Hidden Cat", show_in_pos=False)
        
        # 2. Create a category intended to be visible
        cat_visible = MenuCategory.objects.create(name="Test Visible Cat", show_in_pos=True)
        
        # 3. Create a product in each category
        prod_hidden = Product.objects.create(name="Prod in Hidden", category=cat_hidden, price=10)
        prod_visible = Product.objects.create(name="Prod in Visible", category=cat_visible, price=10)
        prod_uncat = Product.objects.create(name="Prod Uncategorized", price=10)
        
        # 4. Simulate the POSQuerySet
        pos_queryset = Product.objects.filter(availability_status='available').filter(
            Q(category__isnull=True) | Q(category__show_in_pos=True)
        )
        
        pos_ids = list(pos_queryset.values_list('id', flat=True))
        
        # 5. Verify
        assert prod_hidden.id not in pos_ids, "Hidden product should not be in POS"
        assert prod_visible.id in pos_ids, "Visible product should be in POS"
        assert prod_uncat.id in pos_ids, "Uncategorized product should be in POS"
        
        print("TEST PASSED: The Q filter correctly excludes hidden categories while keeping visible and uncategorized products.")
        
    except Exception as e:
        print(f"TEST FAILED with exception: {e}")
        
    finally:
        # Cleanup
        if 'cat_hidden' in locals():
            cat_hidden.delete()
        if 'cat_visible' in locals():
            cat_visible.delete()
        if 'prod_uncat' in locals():
            prod_uncat.delete()

if __name__ == '__main__':
    test_pos_filter()
