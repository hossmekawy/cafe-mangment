"""
Advanced test suite for the Inventory app.
Covers: services, models, API endpoints, transactional edge cases.
"""
import decimal
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

from authentication.models import Branch, CustomUser
from inventory.models import (
    Unit, StorageLocation, RawMaterial, StockBatch,
    StockMovement, WasteLog, PhysicalCount, PhysicalCountItem,
    Recipe, RecipeIngredient, Notification,
)
from inventory.services import (
    log_stock_movement, check_low_stock, deduct_stock_for_waste,
    reconcile_physical_count, calculate_inventory_value,
)


class BaseInventoryTestCase(TestCase):
    """Shared setup for all inventory tests."""

    @classmethod
    def setUpTestData(cls):
        cls.branch = Branch.objects.create(name='Test Branch')
        cls.unit = Unit.objects.create(name='Kilogram', abbreviation='kg')
        cls.location = StorageLocation.objects.create(name='Main Fridge', branch=cls.branch)

        cls.admin_user = CustomUser.objects.create_user(
            username='test_admin', password='Admin123!', name='Admin Tester',
            role='super_admin', is_staff=True, branch=cls.branch,
        )
        cls.cashier_user = CustomUser.objects.create_user(
            username='test_cashier', password='Cash123!', name='Cashier Tester',
            role='cashier', branch=cls.branch,
        )

        cls.material = RawMaterial.objects.create(
            name='Coffee Beans',
            category='beverages',
            unit=cls.unit,
            current_stock=decimal.Decimal('100.000'),
            minimum_stock=decimal.Decimal('10.000'),
            reorder_quantity=decimal.Decimal('50.000'),
            cost_per_unit=decimal.Decimal('5.00'),
            storage_location=cls.location,
        )


# ─────────────────────────────── Service Layer Tests ──────────────────────────

class LogStockMovementTests(BaseInventoryTestCase):
    """Tests for inventory.services.log_stock_movement"""

    def test_inbound_movement_increases_stock(self):
        movement = log_stock_movement(
            raw_material=self.material,
            movement_type='purchase',
            quantity=50,
            performed_by=self.admin_user,
            note='Test purchase',
        )
        self.material.refresh_from_db()
        self.assertEqual(self.material.current_stock, decimal.Decimal('150.000'))
        self.assertEqual(movement.quantity_before, decimal.Decimal('100.000'))
        self.assertEqual(movement.quantity_after, decimal.Decimal('150.000'))
        self.assertEqual(movement.movement_type, 'purchase')

    def test_outbound_movement_decreases_stock(self):
        log_stock_movement(
            raw_material=self.material,
            movement_type='consumption',
            quantity=-30,
            performed_by=self.admin_user,
        )
        self.material.refresh_from_db()
        self.assertEqual(self.material.current_stock, decimal.Decimal('70.000'))

    def test_movement_creates_audit_trail(self):
        initial_count = StockMovement.objects.filter(raw_material=self.material).count()
        log_stock_movement(
            raw_material=self.material,
            movement_type='manual_adjustment',
            quantity=10,
        )
        self.assertEqual(
            StockMovement.objects.filter(raw_material=self.material).count(),
            initial_count + 1,
        )

    def test_low_stock_notification_triggered(self):
        """When stock drops below minimum, a Notification should be created."""
        log_stock_movement(
            raw_material=self.material,
            movement_type='consumption',
            quantity=-95,  # Drop from 100 to 5, well below min of 10
        )
        self.assertTrue(
            Notification.objects.filter(title__icontains='Coffee Beans', is_read=False).exists()
        )



class DuplicateNotificationTests(TestCase):
    """Isolated test for duplicate notification prevention."""

    def test_no_duplicate_low_stock_notifications(self):
        """Multiple consecutive drops should NOT create duplicate notifications."""
        branch = Branch.objects.create(name='Notif Branch')
        unit = Unit.objects.create(name='Pieces', abbreviation='pcs')
        mat = RawMaterial.objects.create(
            name='Notif Test Material', category='other', unit=unit,
            current_stock=decimal.Decimal('100.000'),
            minimum_stock=decimal.Decimal('10.000'),
            cost_per_unit=decimal.Decimal('1.00'),
        )
        log_stock_movement(mat, 'consumption', -92)  # Drops to 8 (below min 10)
        log_stock_movement(mat, 'consumption', -1)   # Drops to 7
        notifs = Notification.objects.filter(title__icontains='Notif Test Material', is_read=False)
        self.assertEqual(notifs.count(), 1)


class WasteServiceTests(BaseInventoryTestCase):
    """Tests for inventory.services.deduct_stock_for_waste"""

    def test_waste_deducts_stock_and_creates_log(self):
        waste = deduct_stock_for_waste(
            raw_material=self.material,
            quantity=10,
            reason='expired',
            logged_by=self.admin_user,
        )
        self.material.refresh_from_db()
        self.assertEqual(self.material.current_stock, decimal.Decimal('90.000'))
        self.assertIsInstance(waste, WasteLog)
        self.assertEqual(waste.cost_value, decimal.Decimal('50.00'))  # 10 * 5.00

    def test_waste_log_linked_to_stock_movement(self):
        waste = deduct_stock_for_waste(self.material, 5, 'damaged')
        movement = StockMovement.objects.filter(waste_log=waste).first()
        self.assertIsNotNone(movement)
        self.assertEqual(movement.movement_type, 'waste')
        self.assertEqual(movement.quantity, decimal.Decimal('-5'))


class PhysicalCountTests(BaseInventoryTestCase):
    """Tests for inventory.services.reconcile_physical_count"""

    def test_reconciliation_applies_positive_discrepancy(self):
        count = PhysicalCount.objects.create(
            branch=self.branch, status='draft', started_by=self.admin_user,
            completed_by=self.admin_user,
        )
        PhysicalCountItem.objects.create(
            physical_count=count, raw_material=self.material,
            system_quantity=100, counted_quantity=110,
            discrepancy=10, discrepancy_value=50,
        )
        reconcile_physical_count(count)
        self.material.refresh_from_db()
        self.assertEqual(self.material.current_stock, decimal.Decimal('110.000'))

    def test_reconciliation_applies_negative_discrepancy(self):
        count = PhysicalCount.objects.create(
            branch=self.branch, status='draft', started_by=self.admin_user,
            completed_by=self.admin_user,
        )
        PhysicalCountItem.objects.create(
            physical_count=count, raw_material=self.material,
            system_quantity=100, counted_quantity=90,
            discrepancy=-10, discrepancy_value=50,
        )
        reconcile_physical_count(count)
        self.material.refresh_from_db()
        self.assertEqual(self.material.current_stock, decimal.Decimal('90.000'))

    def test_double_reconciliation_raises_error(self):
        count = PhysicalCount.objects.create(
            branch=self.branch, status='draft', started_by=self.admin_user,
            completed_by=self.admin_user,
        )
        PhysicalCountItem.objects.create(
            physical_count=count, raw_material=self.material,
            system_quantity=100, counted_quantity=100,
            discrepancy=0, discrepancy_value=0,
        )
        reconcile_physical_count(count)
        with self.assertRaises(ValueError):
            reconcile_physical_count(count)


class InventoryValueTests(BaseInventoryTestCase):

    def test_calculate_inventory_value(self):
        value = calculate_inventory_value()
        # 100 stock * 5.00 cost = 500.00
        self.assertEqual(value, decimal.Decimal('500.00'))


# ─────────────────────────────── API Endpoint Tests ───────────────────────────

class MaterialAPITests(BaseInventoryTestCase):
    """Tests for /api/inventory/materials/ ViewSet."""

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin_user)
        self.materials_url = reverse('rawmaterial-list')

    def test_list_materials(self):
        response = self.client.get(self.materials_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    def test_create_material(self):
        data = {
            'name': 'Whole Milk',
            'category': 'dairy',
            'unit': self.unit.id,
            'minimum_stock': '5.000',
            'reorder_quantity': '20.000',
            'cost_per_unit': '1.50',
        }
        response = self.client.post(self.materials_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(RawMaterial.objects.filter(name='Whole Milk').exists())

    def test_any_authenticated_user_can_create_material(self):
        """Materials ViewSet uses IsAuthenticated; cashiers should also be able to create."""
        self.client.force_authenticate(user=self.cashier_user)
        data = {'name': 'Cashier Item', 'category': 'other', 'unit': self.unit.id,
                'minimum_stock': '1', 'reorder_quantity': '5', 'cost_per_unit': '1.00'}
        response = self.client.post(self.materials_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_update_material(self):
        url = reverse('rawmaterial-detail', args=[self.material.id])
        data = {'name': 'Premium Coffee Beans', 'category': 'beverages', 'unit': self.unit.id,
                'minimum_stock': '10.000', 'reorder_quantity': '50.000', 'cost_per_unit': '7.00'}
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.material.refresh_from_db()
        self.assertEqual(self.material.name, 'Premium Coffee Beans')

    def test_delete_material(self):
        mat = RawMaterial.objects.create(
            name='Deletable Item', category='other', unit=self.unit,
        )
        url = reverse('rawmaterial-detail', args=[mat.id])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(RawMaterial.objects.filter(id=mat.id).exists())

    def test_low_stock_action(self):
        """Test the custom /materials/low_stock/ action."""
        self.material.current_stock = decimal.Decimal('5.000')  # Below min of 10
        self.material.save()
        url = reverse('rawmaterial-low-stock')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class UnitAPITests(BaseInventoryTestCase):

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin_user)

    def test_list_units(self):
        response = self.client.get(reverse('unit-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class StockMovementAPITests(BaseInventoryTestCase):

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin_user)
        # Pre-seed a movement
        log_stock_movement(self.material, 'purchase', 10)

    def test_list_movements(self):
        response = self.client.get(reverse('stockmovement-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ─────────────────── Bulk / Performance Sanity ────────────────────────────────

class BulkDataSanityTests(TestCase):
    """After seed_bulk_data, ensure large queries don't crash."""

    def test_queryset_count_does_not_crash(self):
        """Simply calling .count() on large tables should succeed."""
        count = StockMovement.objects.count()
        self.assertIsInstance(count, int)

    def test_material_list_with_many_rows(self):
        count = RawMaterial.objects.count()
        self.assertIsInstance(count, int)

class ProductAPIIntegrationTests(BaseInventoryTestCase):
    """Tests for ProductViewSet CRUD operations."""

    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin_user)
        self.product_data = {
            'name': 'Test Espresso',
            'category': 'hot_drinks',
            'price': '3.50',
            'is_active': True
        }

    def test_create_product(self):
        url = reverse('product-list')
        response = self.client.post(url, self.product_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Test Espresso')
        self.assertEqual(response.data['price'], '3.50')

    def test_update_product(self):
        url = reverse('product-list')
        response = self.client.post(url, self.product_data)
        product_id = response.data['id']

        update_url = reverse('product-detail', args=[product_id])
        update_data = self.product_data.copy()
        update_data['price'] = '4.00'
        update_response = self.client.put(update_url, update_data)
        
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data['price'], '4.00')

class UnitConversionAPIIntegrationTests(BaseInventoryTestCase):
    """Tests for UnitConversionViewSet and cost calculation logic."""

    def setUp(self):
        from inventory.models import Unit, UnitConversion, Product, Recipe, RecipeIngredient
        super().setUp()
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin_user)
        
        # We already have a base unit: 'Kilogram' (kg) from setup
        self.gram_unit = Unit.objects.create(name='Gram', abbreviation='g')
        
        # Create a conversion rule
        self.conversion = UnitConversion.objects.create(
            from_unit=self.unit, # kg
            to_unit=self.gram_unit, # g
            multiplier=decimal.Decimal('1000.00000') # 1 kg = 1000 g
        )
        
        # Create an associated product
        self.product = Product.objects.create(
            name='Coffee Latte',
            category='hot_drinks',
            price=decimal.Decimal('4.50')
        )

    def test_create_unit_conversion_via_api(self):
        """Verify the API endpoint works correctly."""
        liters = Unit.objects.create(name='Liters', abbreviation='L')
        ml = Unit.objects.create(name='Milliliters', abbreviation='ml')
        
        url = reverse('unitconversion-list')
        data = {
            'from_unit': liters.id,
            'to_unit': ml.id,
            'multiplier': '1000'
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(float(response.data['multiplier']), 1000.0)

    def test_recipe_dynamic_cost_calculation(self):
        """Verify the 'get_cost' logic via the serializer's 'total_cost' method."""
        from inventory.models import Recipe, RecipeIngredient
        
        # Target test: self.material is 100 kg at $5.00/kg (Cost of 1 kg is $5.00, Cost of 1g is $0.005)
        # Formula: 20 grams of coffee beans per latte.
        
        recipe = Recipe.objects.create(
            product=self.product,
            yield_quantity=decimal.Decimal('1.00'),
            preparation_time=5
        )
        
        RecipeIngredient.objects.create(
            recipe=recipe,
            raw_material=self.material,
            quantity=decimal.Decimal('20.000'), # 20
            unit=self.gram_unit # grams
        )
        
        # Fetch the recipe from the API to check the serialized cost
        url = reverse('recipe-detail', args=[recipe.id])
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Expected cost = 20 grams * ($5.00 base cost per kg / 1000 multiplier) = 20 * 0.005 = 0.10
        expected_cost = 0.10
        
        self.assertEqual(float(response.data['total_cost']), expected_cost)
        self.assertEqual(float(response.data['ingredients'][0]['cost']), expected_cost)
