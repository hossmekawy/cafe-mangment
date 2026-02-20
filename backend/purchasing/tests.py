"""
Advanced test suite for the Purchasing app.
Covers: models, complete_grn transactional service, API endpoints, signals.
"""
import decimal
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status as http_status

from authentication.models import Branch, CustomUser
from inventory.models import (
    Unit, StorageLocation, RawMaterial, StockBatch, StockMovement,
)
from purchasing.models import (
    Supplier, SupplierMaterial, PriceHistory,
    PurchaseOrder, PurchaseOrderItem,
    GoodsReceivedNote, GRNItem,
    SupplierInvoice,
)
from purchasing.services import complete_grn


class BasePurchasingTestCase(TestCase):
    """Shared setup for purchasing tests."""

    @classmethod
    def setUpTestData(cls):
        cls.branch = Branch.objects.create(name='Test Branch')
        cls.unit = Unit.objects.create(name='Kilogram', abbreviation='kg')
        cls.location = StorageLocation.objects.create(name='Main Fridge', branch=cls.branch)

        cls.admin_user = CustomUser.objects.create_user(
            username='purchase_admin', password='Admin123!', name='Purchase Admin',
            role='super_admin', is_staff=True, branch=cls.branch,
        )
        cls.cashier_user = CustomUser.objects.create_user(
            username='purchase_cashier', password='Cash123!', name='Purchase Cashier',
            role='cashier', branch=cls.branch,
        )

        cls.supplier = Supplier.objects.create(
            name='Test Supplier Co.',
            contact_person='John Doe',
            email='john@testsupplier.com',
        )

        cls.material_a = RawMaterial.objects.create(
            name='Sugar', category='dry_goods', unit=cls.unit,
            current_stock=decimal.Decimal('50.000'),
            cost_per_unit=decimal.Decimal('2.00'),
            storage_location=cls.location,
        )
        cls.material_b = RawMaterial.objects.create(
            name='Flour', category='dry_goods', unit=cls.unit,
            current_stock=decimal.Decimal('30.000'),
            cost_per_unit=decimal.Decimal('1.50'),
            storage_location=cls.location,
        )


# ───────────────────────── GRN Transactional Tests ────────────────────────────

class CompleteGRNServiceTests(BasePurchasingTestCase):
    """Core business logic: The atomic complete_grn transaction."""

    def _create_grn_with_items(self, items_data, po=None):
        grn = GoodsReceivedNote.objects.create(
            grn_number=f'GRN-TEST-{GoodsReceivedNote.objects.count() + 1}',
            supplier=self.supplier,
            purchase_order=po,
            received_by=self.admin_user,
        )
        for item in items_data:
            GRNItem.objects.create(grn=grn, **item)
        return grn

    def test_complete_grn_increases_stock(self):
        """The most critical test: completing a GRN should add items to inventory."""
        initial_stock = self.material_a.current_stock
        grn = self._create_grn_with_items([{
            'raw_material': self.material_a,
            'quantity_received': decimal.Decimal('25.000'),
            'unit_price': decimal.Decimal('2.50'),
        }])

        complete_grn(grn.id, self.admin_user)

        self.material_a.refresh_from_db()
        self.assertEqual(self.material_a.current_stock, initial_stock + decimal.Decimal('25.000'))

    def test_complete_grn_creates_stock_batch(self):
        """A new FIFO batch should exist after completion."""
        grn = self._create_grn_with_items([{
            'raw_material': self.material_a,
            'quantity_received': decimal.Decimal('10.000'),
            'unit_price': decimal.Decimal('3.00'),
        }])
        initial_batch_count = StockBatch.objects.filter(raw_material=self.material_a).count()

        complete_grn(grn.id, self.admin_user)

        self.assertEqual(
            StockBatch.objects.filter(raw_material=self.material_a).count(),
            initial_batch_count + 1,
        )

    def test_complete_grn_creates_stock_movement(self):
        grn = self._create_grn_with_items([{
            'raw_material': self.material_b,
            'quantity_received': decimal.Decimal('15.000'),
            'unit_price': decimal.Decimal('1.80'),
        }])
        complete_grn(grn.id, self.admin_user)

        movement = StockMovement.objects.filter(
            raw_material=self.material_b, movement_type='purchase', grn=grn,
        ).first()
        self.assertIsNotNone(movement)
        self.assertEqual(movement.quantity, decimal.Decimal('15.000'))

    def test_complete_grn_auto_creates_invoice(self):
        """An unpaid SupplierInvoice should be auto-created."""
        grn = self._create_grn_with_items([{
            'raw_material': self.material_a,
            'quantity_received': decimal.Decimal('20.000'),
            'unit_price': decimal.Decimal('2.00'),
        }])
        complete_grn(grn.id, self.admin_user)

        invoice = SupplierInvoice.objects.filter(grn=grn).first()
        self.assertIsNotNone(invoice)
        self.assertEqual(invoice.status, 'unpaid')
        self.assertEqual(invoice.total_amount, decimal.Decimal('40.00'))  # 20 * 2.00

    def test_complete_grn_updates_material_cost(self):
        """The material's cost_per_unit should be set to the GRN item's unit_price."""
        grn = self._create_grn_with_items([{
            'raw_material': self.material_a,
            'quantity_received': decimal.Decimal('10.000'),
            'unit_price': decimal.Decimal('99.99'),
        }])
        complete_grn(grn.id, self.admin_user)
        self.material_a.refresh_from_db()
        self.assertEqual(self.material_a.cost_per_unit, decimal.Decimal('99.99'))

    def test_complete_grn_marks_status(self):
        grn = self._create_grn_with_items([{
            'raw_material': self.material_a,
            'quantity_received': decimal.Decimal('5.000'),
            'unit_price': decimal.Decimal('2.00'),
        }])
        result = complete_grn(grn.id, self.admin_user)
        self.assertEqual(result.status, 'completed')

    def test_double_complete_raises_error(self):
        grn = self._create_grn_with_items([{
            'raw_material': self.material_a,
            'quantity_received': decimal.Decimal('5.000'),
            'unit_price': decimal.Decimal('2.00'),
        }])
        complete_grn(grn.id, self.admin_user)
        with self.assertRaises(ValueError):
            complete_grn(grn.id, self.admin_user)

    def test_empty_grn_raises_error(self):
        grn = GoodsReceivedNote.objects.create(
            grn_number='GRN-EMPTY', supplier=self.supplier, received_by=self.admin_user,
        )
        with self.assertRaises(ValueError):
            complete_grn(grn.id, self.admin_user)

    def test_grn_with_po_updates_po_item_received_qty(self):
        """If GRN is linked to a PO, the PO item's quantity_received should update."""
        po = PurchaseOrder.objects.create(
            po_number='PO-TEST-001', supplier=self.supplier,
            status='confirmed', created_by=self.admin_user,
        )
        PurchaseOrderItem.objects.create(
            purchase_order=po, raw_material=self.material_a,
            quantity_ordered=100, unit_price=2.00, total_price=200,
        )

        grn = self._create_grn_with_items([{
            'raw_material': self.material_a,
            'quantity_received': decimal.Decimal('60.000'),
            'unit_price': decimal.Decimal('2.00'),
        }], po=po)

        complete_grn(grn.id, self.admin_user)

        po_item = PurchaseOrderItem.objects.get(purchase_order=po, raw_material=self.material_a)
        self.assertEqual(po_item.quantity_received, decimal.Decimal('60.000'))

        po.refresh_from_db()
        self.assertEqual(po.status, 'partially_received')

    def test_grn_fully_receiving_po_marks_received(self):
        po = PurchaseOrder.objects.create(
            po_number='PO-TEST-002', supplier=self.supplier,
            status='confirmed', created_by=self.admin_user,
        )
        PurchaseOrderItem.objects.create(
            purchase_order=po, raw_material=self.material_a,
            quantity_ordered=10, unit_price=2.00, total_price=20,
        )
        grn = self._create_grn_with_items([{
            'raw_material': self.material_a,
            'quantity_received': decimal.Decimal('10.000'),
            'unit_price': decimal.Decimal('2.00'),
        }], po=po)

        complete_grn(grn.id, self.admin_user)
        po.refresh_from_db()
        self.assertEqual(po.status, 'received')

    def test_multi_item_grn(self):
        """Multiple items in a single GRN should all be processed."""
        grn = self._create_grn_with_items([
            {'raw_material': self.material_a, 'quantity_received': decimal.Decimal('10'), 'unit_price': decimal.Decimal('2')},
            {'raw_material': self.material_b, 'quantity_received': decimal.Decimal('20'), 'unit_price': decimal.Decimal('1.50')},
        ])
        complete_grn(grn.id, self.admin_user)

        self.material_a.refresh_from_db()
        self.material_b.refresh_from_db()
        self.assertEqual(self.material_a.current_stock, decimal.Decimal('60.000'))
        self.assertEqual(self.material_b.current_stock, decimal.Decimal('50.000'))


# ────────────────────────── Price History Signal Tests ─────────────────────────

class PriceHistorySignalTests(BasePurchasingTestCase):
    """Tests for the pre_save signal on SupplierMaterial."""

    def test_price_change_creates_history_entry(self):
        sm = SupplierMaterial.objects.create(
            supplier=self.supplier, raw_material=self.material_a, unit_price=decimal.Decimal('5.00'),
        )
        initial_history_count = PriceHistory.objects.filter(supplier_material=sm).count()

        sm.unit_price = decimal.Decimal('6.50')
        sm.save()

        self.assertEqual(
            PriceHistory.objects.filter(supplier_material=sm).count(),
            initial_history_count + 1,
        )

    def test_no_history_on_same_price(self):
        sm = SupplierMaterial.objects.create(
            supplier=self.supplier, raw_material=self.material_a, unit_price=decimal.Decimal('5.00'),
        )
        initial_history_count = PriceHistory.objects.filter(supplier_material=sm).count()

        sm.unit_price = decimal.Decimal('5.00')  # Same price
        sm.save()

        self.assertEqual(
            PriceHistory.objects.filter(supplier_material=sm).count(),
            initial_history_count,  # Should remain the same
        )


# ─────────────────────────── API Endpoint Tests ───────────────────────────────

class SupplierAPITests(BasePurchasingTestCase):

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin_user)

    def test_list_suppliers(self):
        response = self.client.get(reverse('supplier-list'))
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)

    def test_create_supplier(self):
        data = {'name': 'New Supplier', 'email': 'new@supplier.com'}
        response = self.client.post(reverse('supplier-list'), data, format='json')
        self.assertEqual(response.status_code, http_status.HTTP_201_CREATED)

    def test_cashier_cannot_create_supplier(self):
        self.client.force_authenticate(user=self.cashier_user)
        data = {'name': 'Blocked Supplier'}
        response = self.client.post(reverse('supplier-list'), data, format='json')
        self.assertIn(response.status_code, [http_status.HTTP_403_FORBIDDEN])


class PurchaseOrderAPITests(BasePurchasingTestCase):

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin_user)

    def test_list_orders(self):
        response = self.client.get(reverse('purchaseorder-list'))
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)

    def test_confirm_draft_order(self):
        po = PurchaseOrder.objects.create(
            po_number='PO-API-001', supplier=self.supplier,
            status='draft', created_by=self.admin_user,
        )
        url = reverse('purchaseorder-confirm', args=[po.id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        po.refresh_from_db()
        self.assertEqual(po.status, 'confirmed')

    def test_cannot_confirm_non_draft(self):
        po = PurchaseOrder.objects.create(
            po_number='PO-API-002', supplier=self.supplier,
            status='confirmed', created_by=self.admin_user,
        )
        url = reverse('purchaseorder-confirm', args=[po.id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, http_status.HTTP_400_BAD_REQUEST)


class GRNAPITests(BasePurchasingTestCase):

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin_user)

    def test_list_grns(self):
        response = self.client.get(reverse('goodsreceivednote-list'))
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)

    def test_complete_grn_via_api(self):
        grn = GoodsReceivedNote.objects.create(
            grn_number='GRN-API-001', supplier=self.supplier,
            received_by=self.admin_user,
        )
        GRNItem.objects.create(
            grn=grn, raw_material=self.material_a,
            quantity_received=decimal.Decimal('10.000'),
            unit_price=decimal.Decimal('2.00'),
        )
        url = reverse('goodsreceivednote-complete', args=[grn.id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        grn.refresh_from_db()
        self.assertEqual(grn.status, 'completed')
