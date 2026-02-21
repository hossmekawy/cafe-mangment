import uuid
from django.db import models
from django.conf import settings
from authentication.models import Branch


# ───────────────────────────────────────────────
#  CASH REGISTER / SHIFT MANAGEMENT
# ───────────────────────────────────────────────

class CashShift(models.Model):
    STATUS_CHOICES = (
        ('open', 'Open'),
        ('closed', 'Closed'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shift_number = models.PositiveIntegerField(default=0, help_text="Auto-incrementing shift number per branch")
    cashier = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='cash_shifts')
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='cash_shifts')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='open')

    # Opening
    opening_cash = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    opened_at = models.DateTimeField(auto_now_add=True)

    # Closing
    expected_closing_cash = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    actual_closing_cash = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    discrepancy = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    discrepancy_reason = models.TextField(blank=True, null=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    # Totals computed at close
    total_cash_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_card_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_other_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_refunds = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_cash_drops = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    # Manager approval
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_shifts')
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['cashier', 'branch'],
                condition=models.Q(status='open'),
                name='unique_open_shift_per_cashier_branch'
            )
        ]
        ordering = ['-opened_at']

    def save(self, *args, **kwargs):
        if not self.shift_number:
            last = CashShift.objects.filter(branch=self.branch).order_by('-shift_number').values_list('shift_number', flat=True).first()
            self.shift_number = (last or 0) + 1
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Shift #{self.shift_number} - {self.cashier} ({self.status})"


class CashDenomination(models.Model):
    """Denomination-by-denomination count for both opening and closing."""
    TYPE_CHOICES = (
        ('opening', 'Opening'),
        ('closing', 'Closing'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shift = models.ForeignKey(CashShift, on_delete=models.CASCADE, related_name='denominations')
    count_type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    denomination = models.IntegerField(help_text="EGP note/coin value: 500, 200, 100, 50, 20, 10, 5, 1")
    quantity = models.IntegerField(default=0)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    class Meta:
        unique_together = ('shift', 'count_type', 'denomination')

    def save(self, *args, **kwargs):
        self.subtotal = self.denomination * self.quantity
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.quantity}x {self.denomination} EGP ({self.count_type})"


class CashMovement(models.Model):
    """Every cash register event during a shift."""
    TYPE_CHOICES = (
        ('sale', 'Sale'),
        ('refund', 'Refund'),
        ('void', 'Void'),
        ('cash_drop', 'Cash Drop'),
        ('petty_cash', 'Petty Cash'),
        ('manual_in', 'Manual Cash In'),
        ('manual_out', 'Manual Cash Out'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shift = models.ForeignKey(CashShift, on_delete=models.CASCADE, related_name='movements')
    movement_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.TextField(blank=True, null=True)
    reference_order = models.ForeignKey('pos.Order', on_delete=models.SET_NULL, null=True, blank=True)
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.movement_type}: {self.amount} EGP"


class CashDrop(models.Model):
    """Mid-shift removal of excess cash to safe."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shift = models.ForeignKey(CashShift, on_delete=models.CASCADE, related_name='cash_drops')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    note = models.TextField(blank=True, null=True)
    dropped_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Cash Drop: {self.amount} EGP"


# ───────────────────────────────────────────────
#  SALES JOURNAL / TRANSACTION LOG
# ───────────────────────────────────────────────

class SalesTransaction(models.Model):
    """Journal entry for every financial event."""
    TYPE_CHOICES = (
        ('sale', 'Sale'),
        ('refund', 'Refund'),
        ('void', 'Void'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transaction_number = models.CharField(max_length=50, unique=True, blank=True)
    transaction_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='sale')

    # Links
    order = models.ForeignKey('pos.Order', on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    payment = models.ForeignKey('pos.Payment', on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    shift = models.ForeignKey(CashShift, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')

    # Financials
    gross_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    service_charge = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    net_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    payment_method = models.CharField(max_length=30, blank=True, null=True)
    cashier = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='sales_transactions')

    is_voided = models.BooleanField(default=False)
    void_reason = models.TextField(blank=True, null=True)
    voided_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='voided_transactions')
    voided_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.transaction_number:
            self.transaction_number = f"TXN-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.transaction_number} ({self.transaction_type})"


class Refund(models.Model):
    """Refund linked to a sales transaction."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    original_transaction = models.ForeignKey(SalesTransaction, on_delete=models.CASCADE, related_name='refunds')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField()
    refunded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='refunds_issued')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Refund {self.amount} on {self.original_transaction.transaction_number}"


# ───────────────────────────────────────────────
#  EXPENSE MANAGEMENT
# ───────────────────────────────────────────────

class ExpenseCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)  # Rent, Utilities, Wages, Supplies, etc.
    name_ar = models.CharField(max_length=100, blank=True, null=True)
    budget_monthly = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, help_text="Monthly budget for this category")
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "Expense Categories"
        ordering = ['name']

    def __str__(self):
        return self.name


class Expense(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )
    PAYMENT_METHOD_CHOICES = (
        ('cash', 'Cash'),
        ('card', 'Card'),
        ('bank_transfer', 'Bank Transfer'),
        ('petty_cash', 'Petty Cash'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(ExpenseCategory, on_delete=models.PROTECT, related_name='expenses')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    vat_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    vendor = models.CharField(max_length=200, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default='cash')
    receipt_base64 = models.TextField(blank=True, null=True, help_text="Base64 encoded receipt image")

    date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='approved')
    approval_threshold = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, help_text="Expenses above this need approval")

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='expenses_created')
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='expenses_approved')
    approved_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.category.name}: {self.amount} EGP on {self.date}"


# ───────────────────────────────────────────────
#  PETTY CASH
# ───────────────────────────────────────────────

class PettyCashFund(models.Model):
    """The cash fund itself — one per branch."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.OneToOneField(Branch, on_delete=models.CASCADE, related_name='petty_cash')
    float_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, help_text="Authorised float amount")
    current_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Petty Cash ({self.branch.name}): {self.current_balance} EGP"


class PettyCashTransaction(models.Model):
    TYPE_CHOICES = (
        ('spend', 'Spend'),
        ('replenish', 'Replenish'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fund = models.ForeignKey(PettyCashFund, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    purpose = models.TextField(blank=True, null=True)
    reference = models.CharField(max_length=100, blank=True, null=True)
    receipt_base64 = models.TextField(blank=True, null=True)
    running_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.transaction_type}: {self.amount} EGP"


# ───────────────────────────────────────────────
#  BANK ACCOUNTS & RECONCILIATION
# ───────────────────────────────────────────────

class BankAccount(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    bank_name = models.CharField(max_length=200)
    account_number = models.CharField(max_length=50)
    iban = models.CharField(max_length=50, blank=True, null=True)
    current_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.bank_name})"


class BankReconciliation(models.Model):
    STATUS_CHOICES = (
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bank_account = models.ForeignKey(BankAccount, on_delete=models.CASCADE, related_name='reconciliations')
    period_start = models.DateField()
    period_end = models.DateField()
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='in_progress')

    system_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    bank_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    difference = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)

    completed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-period_start']

    def __str__(self):
        return f"Recon {self.bank_account.name}: {self.period_start} – {self.period_end}"


class BankReconciliationItem(models.Model):
    STATUS_CHOICES = (
        ('matched', 'Matched'),
        ('unmatched', 'Unmatched'),
    )
    SOURCE_CHOICES = (
        ('system', 'System'),
        ('bank', 'Bank Statement'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reconciliation = models.ForeignKey(BankReconciliation, on_delete=models.CASCADE, related_name='items')
    source = models.CharField(max_length=10, choices=SOURCE_CHOICES)
    date = models.DateField()
    description = models.CharField(max_length=300)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='unmatched')
    matched_with = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='matched_pair')

    def __str__(self):
        return f"{self.source}: {self.description} ({self.amount})"


# ───────────────────────────────────────────────
#  CORPORATE CLIENTS & INVOICES
# ───────────────────────────────────────────────

class CorporateClient(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company_name = models.CharField(max_length=300)
    trn = models.CharField(max_length=50, blank=True, null=True, help_text="Tax Registration Number")
    commercial_registration = models.CharField(max_length=100, blank=True, null=True)
    contact_person = models.CharField(max_length=200, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    payment_terms_days = models.IntegerField(default=30, help_text="Net payment terms in days")
    outstanding_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['company_name']

    def __str__(self):
        return self.company_name


class CorporateInvoice(models.Model):
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
        ('cancelled', 'Cancelled'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice_number = models.CharField(max_length=50, unique=True, blank=True)
    client = models.ForeignKey(CorporateClient, on_delete=models.CASCADE, related_name='invoices')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')

    # Financials
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=14.00)
    vat_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    service_charge = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)

    # Payment tracking
    amount_paid = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    amount_due = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)

    issue_date = models.DateField()
    due_date = models.DateField()

    notes = models.TextField(blank=True, null=True)

    # ETA (Egyptian Tax Authority) submission
    eta_submitted = models.BooleanField(default=False)
    eta_submission_date = models.DateTimeField(null=True, blank=True)
    eta_status = models.CharField(max_length=50, blank=True, null=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-issue_date']

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            self.invoice_number = f"INV-{uuid.uuid4().hex[:8].upper()}"
        self.amount_due = self.total_amount - self.amount_paid
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.invoice_number} – {self.client.company_name}"


class CorporateInvoiceItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(CorporateInvoice, on_delete=models.CASCADE, related_name='items')
    description = models.CharField(max_length=300)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1.00)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    def save(self, *args, **kwargs):
        self.total_price = self.quantity * self.unit_price
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.description} ({self.quantity}x)"


class CorporateInvoicePayment(models.Model):
    """Track partial payments against corporate invoices."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(CorporateInvoice, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    payment_method = models.CharField(max_length=30, default='bank_transfer')
    reference = models.CharField(max_length=100, blank=True, null=True)
    date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Payment {self.amount} on {self.invoice.invoice_number}"


# ───────────────────────────────────────────────
#  END-OF-DAY REPORT
# ───────────────────────────────────────────────

class EODReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='eod_reports')
    report_date = models.DateField()

    # Sales summary
    total_sales = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    total_refunds = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    total_voids = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    total_discounts = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    net_revenue = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)

    # Expenses
    total_expenses = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)

    # Payment method breakdown (JSON)
    payment_breakdown = models.JSONField(default=dict, blank=True)

    # Cash reconciliation
    opening_cash = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    cash_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    cash_expenses = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    cash_drops = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    expected_closing_cash = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    actual_closing_cash = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    cash_discrepancy = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    # Tax
    total_vat = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_service_charge = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    # Approval
    is_locked = models.BooleanField(default=False)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_eod_reports')
    approved_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('branch', 'report_date')
        ordering = ['-report_date']

    def __str__(self):
        return f"EOD {self.branch.name} - {self.report_date}"
