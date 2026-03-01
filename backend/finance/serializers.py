from rest_framework import serializers
from .models import (
    CashShift, CashDenomination, CashMovement, CashDrop,
    SalesTransaction, Refund,
    ExpenseCategory, Expense,
    PettyCashFund, PettyCashTransaction,
    BankAccount, BankReconciliation, BankReconciliationItem,
    CorporateClient, CorporateInvoice, CorporateInvoiceItem, CorporateInvoicePayment,
    EODReport,
)


# ── Cash Register ──────────────────────────────

class CashDenominationSerializer(serializers.ModelSerializer):
    class Meta:
        model = CashDenomination
        fields = '__all__'
        read_only_fields = ['subtotal']


class CashShiftSerializer(serializers.ModelSerializer):
    denominations = CashDenominationSerializer(many=True, read_only=True)
    cashier_name = serializers.CharField(source='cashier.name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    live_expected_cash = serializers.SerializerMethodField()
    staff_names = serializers.SerializerMethodField()

    def get_live_expected_cash(self, obj):
        return float(obj.live_expected_cash)

    def get_staff_names(self, obj):
        names = [obj.cashier.name] if obj.cashier else []
        assigned = list(obj.assigned_users.values_list('name', flat=True))
        all_names = names + [n for n in assigned if n not in names]
        return " - ".join(all_names)

    class Meta:
        model = CashShift
        fields = '__all__'


class CashMovementSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.CharField(source='performed_by.get_full_name', read_only=True)
    order_number = serializers.CharField(source='reference_order.order_number', read_only=True)

    class Meta:
        model = CashMovement
        fields = '__all__'


class CashDropSerializer(serializers.ModelSerializer):
    dropped_by_name = serializers.CharField(source='dropped_by.get_full_name', read_only=True)

    class Meta:
        model = CashDrop
        fields = '__all__'


# ── Sales Journal ──────────────────────────────

class SalesTransactionSerializer(serializers.ModelSerializer):
    cashier_name = serializers.CharField(source='cashier.get_full_name', read_only=True)
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    voided_by_name = serializers.CharField(source='voided_by.get_full_name', read_only=True)

    class Meta:
        model = SalesTransaction
        fields = '__all__'


class RefundSerializer(serializers.ModelSerializer):
    original_transaction_number = serializers.CharField(source='original_transaction.transaction_number', read_only=True)
    refunded_by_name = serializers.CharField(source='refunded_by.get_full_name', read_only=True)

    class Meta:
        model = Refund
        fields = '__all__'


# ── Expenses ───────────────────────────────────

class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = '__all__'


class ExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)

    class Meta:
        model = Expense
        fields = '__all__'


# ── Petty Cash ─────────────────────────────────

class PettyCashFundSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = PettyCashFund
        fields = '__all__'


class PettyCashTransactionSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.CharField(source='performed_by.get_full_name', read_only=True)

    class Meta:
        model = PettyCashTransaction
        fields = '__all__'


# ── Bank Reconciliation ───────────────────────

class BankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankAccount
        fields = '__all__'


class BankReconciliationItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankReconciliationItem
        fields = '__all__'


class BankReconciliationSerializer(serializers.ModelSerializer):
    items = BankReconciliationItemSerializer(many=True, read_only=True)
    bank_account_name = serializers.CharField(source='bank_account.name', read_only=True)
    completed_by_name = serializers.CharField(source='completed_by.get_full_name', read_only=True)

    class Meta:
        model = BankReconciliation
        fields = '__all__'


# ── Corporate Invoicing ───────────────────────

class CorporateClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = CorporateClient
        fields = '__all__'


class CorporateInvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = CorporateInvoiceItem
        fields = '__all__'
        read_only_fields = ['total_price']


class CorporateInvoicePaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CorporateInvoicePayment
        fields = '__all__'


class CorporateInvoiceSerializer(serializers.ModelSerializer):
    items = CorporateInvoiceItemSerializer(many=True, read_only=True)
    payments = CorporateInvoicePaymentSerializer(many=True, read_only=True)
    client_name = serializers.CharField(source='client.company_name', read_only=True)
    client_trn = serializers.CharField(source='client.trn', read_only=True)

    class Meta:
        model = CorporateInvoice
        fields = '__all__'
        read_only_fields = ['amount_due']


# ── EOD Report ─────────────────────────────────

class EODReportSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)

    class Meta:
        model = EODReport
        fields = '__all__'
