from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CashShiftViewSet, CashMovementViewSet, CashDropViewSet,
    SalesTransactionViewSet, RefundViewSet,
    ExpenseCategoryViewSet, ExpenseViewSet,
    PettyCashFundViewSet, PettyCashTransactionViewSet,
    BankAccountViewSet, BankReconciliationViewSet,
    CorporateClientViewSet, CorporateInvoiceViewSet, CorporateInvoicePaymentViewSet,
    EODReportViewSet,
    FinancialReportsView,
)

router = DefaultRouter()
router.register('shifts', CashShiftViewSet)
router.register('cash-movements', CashMovementViewSet)
router.register('cash-drops', CashDropViewSet)
router.register('transactions', SalesTransactionViewSet)
router.register('refunds', RefundViewSet)
router.register('expense-categories', ExpenseCategoryViewSet)
router.register('expenses', ExpenseViewSet)
router.register('petty-cash-funds', PettyCashFundViewSet)
router.register('petty-cash-transactions', PettyCashTransactionViewSet)
router.register('bank-accounts', BankAccountViewSet)
router.register('bank-reconciliations', BankReconciliationViewSet)
router.register('corporate-clients', CorporateClientViewSet)
router.register('corporate-invoices', CorporateInvoiceViewSet)
router.register('corporate-invoice-payments', CorporateInvoicePaymentViewSet)
router.register('eod-reports', EODReportViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('reports/', FinancialReportsView.as_view(), name='financial-reports'),
]
