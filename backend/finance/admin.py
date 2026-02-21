from django.contrib import admin
from .models import (
    CashShift, CashDenomination, CashMovement, CashDrop,
    SalesTransaction, Refund,
    ExpenseCategory, Expense,
    PettyCashFund, PettyCashTransaction,
    BankAccount, BankReconciliation, BankReconciliationItem,
    CorporateClient, CorporateInvoice, CorporateInvoiceItem, CorporateInvoicePayment,
    EODReport,
)


class CashDenominationInline(admin.TabularInline):
    model = CashDenomination
    extra = 0


@admin.register(CashShift)
class CashShiftAdmin(admin.ModelAdmin):
    list_display = ('id', 'cashier', 'branch', 'status', 'opening_cash', 'discrepancy', 'opened_at')
    list_filter = ('status', 'branch')
    inlines = [CashDenominationInline]


@admin.register(CashMovement)
class CashMovementAdmin(admin.ModelAdmin):
    list_display = ('movement_type', 'amount', 'shift', 'created_at')
    list_filter = ('movement_type',)


@admin.register(CashDrop)
class CashDropAdmin(admin.ModelAdmin):
    list_display = ('amount', 'shift', 'dropped_by', 'created_at')


@admin.register(SalesTransaction)
class SalesTransactionAdmin(admin.ModelAdmin):
    list_display = ('transaction_number', 'transaction_type', 'net_amount', 'payment_method', 'created_at')
    list_filter = ('transaction_type', 'payment_method', 'is_voided')
    search_fields = ('transaction_number',)


@admin.register(Refund)
class RefundAdmin(admin.ModelAdmin):
    list_display = ('original_transaction', 'amount', 'refunded_by', 'created_at')


@admin.register(ExpenseCategory)
class ExpenseCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'budget_monthly', 'is_active')


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('category', 'amount', 'vendor', 'date', 'status', 'payment_method')
    list_filter = ('status', 'category', 'payment_method')


@admin.register(PettyCashFund)
class PettyCashFundAdmin(admin.ModelAdmin):
    list_display = ('branch', 'float_amount', 'current_balance')


@admin.register(PettyCashTransaction)
class PettyCashTransactionAdmin(admin.ModelAdmin):
    list_display = ('fund', 'transaction_type', 'amount', 'running_balance', 'created_at')
    list_filter = ('transaction_type',)


@admin.register(BankAccount)
class BankAccountAdmin(admin.ModelAdmin):
    list_display = ('name', 'bank_name', 'account_number', 'current_balance', 'is_active')


@admin.register(BankReconciliation)
class BankReconciliationAdmin(admin.ModelAdmin):
    list_display = ('bank_account', 'period_start', 'period_end', 'status', 'difference')
    list_filter = ('status',)


@admin.register(BankReconciliationItem)
class BankReconciliationItemAdmin(admin.ModelAdmin):
    list_display = ('reconciliation', 'source', 'description', 'amount', 'status')
    list_filter = ('source', 'status')


@admin.register(CorporateClient)
class CorporateClientAdmin(admin.ModelAdmin):
    list_display = ('company_name', 'trn', 'outstanding_balance', 'payment_terms_days')
    search_fields = ('company_name', 'trn')


class CorporateInvoiceItemInline(admin.TabularInline):
    model = CorporateInvoiceItem
    extra = 1


@admin.register(CorporateInvoice)
class CorporateInvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'client', 'status', 'total_amount', 'amount_due', 'due_date')
    list_filter = ('status',)
    inlines = [CorporateInvoiceItemInline]


@admin.register(CorporateInvoicePayment)
class CorporateInvoicePaymentAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'amount', 'payment_method', 'date')


@admin.register(EODReport)
class EODReportAdmin(admin.ModelAdmin):
    list_display = ('branch', 'report_date', 'net_revenue', 'cash_discrepancy', 'is_locked')
    list_filter = ('is_locked', 'branch')
