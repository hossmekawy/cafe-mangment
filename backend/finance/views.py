from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncDate, TruncMonth
from django.utils import timezone
from django.utils.dateparse import parse_date
from decimal import Decimal

from .models import (
    CashShift, CashDenomination, CashMovement, CashDrop,
    SalesTransaction, Refund,
    ExpenseCategory, Expense,
    PettyCashFund, PettyCashTransaction,
    BankAccount, BankReconciliation, BankReconciliationItem,
    CorporateClient, CorporateInvoice, CorporateInvoiceItem, CorporateInvoicePayment,
    EODReport,
)
from .serializers import (
    CashShiftSerializer, CashDenominationSerializer, CashMovementSerializer, CashDropSerializer,
    SalesTransactionSerializer, RefundSerializer,
    ExpenseCategorySerializer, ExpenseSerializer,
    PettyCashFundSerializer, PettyCashTransactionSerializer,
    BankAccountSerializer, BankReconciliationSerializer, BankReconciliationItemSerializer,
    CorporateClientSerializer, CorporateInvoiceSerializer, CorporateInvoiceItemSerializer, CorporateInvoicePaymentSerializer,
    EODReportSerializer,
)


# ═══════════════════════════════════════════════
#  CASH REGISTER / SHIFT MANAGEMENT
# ═══════════════════════════════════════════════

class CashShiftViewSet(viewsets.ModelViewSet):
    queryset = CashShift.objects.all()
    serializer_class = CashShiftSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get('status'):
            qs = qs.filter(status=params['status'])
        if params.get('cashier'):
            qs = qs.filter(cashier=params['cashier'])
        if params.get('date'):
            qs = qs.filter(opened_at__date=parse_date(params['date']))
        return qs

    @action(detail=False, methods=['post'])
    def open_shift(self, request):
        """Open a new cash shift with denomination counts."""
        cashier = request.user
        branch_id = request.data.get('branch')
        
        if not branch_id:
            return Response({'error': 'Branch is required to open a shift.'}, status=status.HTTP_400_BAD_REQUEST)
            
        from authentication.models import Branch, CustomUser
        from django.core.exceptions import ValidationError
        try:
            branch = Branch.objects.get(id=branch_id)
        except (Branch.DoesNotExist, ValidationError):
            return Response({'error': 'A valid branch is required. Superusers without an assigned branch must be assigned one first.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check existing open shift
        if CashShift.objects.filter(cashier=cashier, status='open').exists():
            return Response({'error': 'You already have an open shift.'}, status=status.HTTP_400_BAD_REQUEST)

        denominations = request.data.get('denominations', [])
        opening_cash = sum(d.get('denomination', 0) * d.get('quantity', 0) for d in denominations)

        shift = CashShift.objects.create(
            cashier=cashier,
            branch_id=branch_id,
            opening_cash=Decimal(str(opening_cash)),
        )

        assigned_user_ids = request.data.get('assigned_users', [])
        if isinstance(assigned_user_ids, list):
            if len(assigned_user_ids) > 10:
                shift.delete()
                return Response({'error': 'Maximum 10 users can be assigned.'}, status=status.HTTP_400_BAD_REQUEST)
            users_to_assign = CustomUser.objects.filter(id__in=assigned_user_ids)
            shift.assigned_users.set(users_to_assign)

        for d in denominations:
            CashDenomination.objects.create(
                shift=shift,
                count_type='opening',
                denomination=d['denomination'],
                quantity=d['quantity'],
            )

        return Response(CashShiftSerializer(shift).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def close_shift(self, request, pk=None):
        """Close a shift with closing denomination counts and compute discrepancy."""
        if request.user.role not in ['super_admin', 'manager']:
            return Response({'error': 'Only managers or above can close shifts.'}, status=status.HTTP_403_FORBIDDEN)
            
        shift = self.get_object()
        if shift.status == 'closed':
            return Response({'error': 'Shift is already closed.'}, status=status.HTTP_400_BAD_REQUEST)

        denominations = request.data.get('denominations', [])
        actual_closing = sum(d.get('denomination', 0) * d.get('quantity', 0) for d in denominations)

        for d in denominations:
            CashDenomination.objects.create(
                shift=shift,
                count_type='closing',
                denomination=d['denomination'],
                quantity=d['quantity'],
            )

        # Calculate expected from movements
        cash_sales = shift.movements.filter(movement_type='sale').aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
        cash_refunds = shift.movements.filter(movement_type='refund').aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
        cash_drops_total = shift.cash_drops.aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
        petty_cash_out = shift.movements.filter(movement_type='petty_cash').aggregate(t=Sum('amount'))['t'] or Decimal('0.00')

        expected = shift.opening_cash + cash_sales - cash_refunds - cash_drops_total - petty_cash_out

        shift.actual_closing_cash = Decimal(str(actual_closing))
        shift.expected_closing_cash = expected
        shift.discrepancy = shift.actual_closing_cash - expected
        shift.discrepancy_reason = request.data.get('discrepancy_reason', '')
        shift.total_cash_sales = cash_sales
        shift.total_refunds = cash_refunds
        shift.total_cash_drops = cash_drops_total
        shift.status = 'closed'
        shift.closed_at = timezone.now()
        shift.save()

        return Response(CashShiftSerializer(shift).data)

    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get the current open shift for the requesting user."""
        from django.db.models import Q
        shift = CashShift.objects.filter(
            Q(cashier=request.user) | Q(assigned_users=request.user),
            status='open'
        ).distinct().first()
        if not shift:
            return Response({'detail': 'No open shift.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(CashShiftSerializer(shift).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Manager approves a closed shift."""
        shift = self.get_object()
        shift.approved_by = request.user
        shift.approved_at = timezone.now()
        shift.save()
        return Response(CashShiftSerializer(shift).data)

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        """Live summary of a shift: revenue, order count, payment breakdown."""
        from pos.models import Order, Payment
        from django.db.models import Sum, Count

        shift = self.get_object()

        orders = Order.objects.filter(shift=shift, status='completed')
        order_count = orders.count()
        total_revenue = orders.aggregate(t=Sum('total_amount'))['t'] or 0
        total_discounts = orders.aggregate(t=Sum('discount_amount'))['t'] or 0

        payments = Payment.objects.filter(order__shift=shift, order__status='completed')
        breakdown = {}
        for row in payments.values('payment_method').annotate(total=Sum('amount')):
            breakdown[row['payment_method']] = float(row['total'])

        order_list = list(orders.values(
            'id', 'order_number', 'order_type', 'total_amount', 'created_at'
        ).order_by('-created_at')[:50])  # Last 50 orders in shift

        return Response({
            'shift_number': shift.shift_number,
            'cashier_name': shift.cashier.name,
            'opened_at': shift.opened_at,
            'status': shift.status,
            'opening_cash': float(shift.opening_cash),
            'order_count': order_count,
            'total_revenue': float(total_revenue),
            'total_discounts': float(total_discounts),
            'payment_breakdown': breakdown,
            'order_list': order_list,
        })

    @action(detail=True, methods=['post'])
    def assign_user(self, request, pk=None):
        """Add users to an ongoing collaborative shift."""
        shift = self.get_object()
        if shift.status == 'closed':
            return Response({'error': 'Cannot assign users to closed shift.'}, status=status.HTTP_400_BAD_REQUEST)
            
        user_ids = request.data.get('user_ids', [])
        if not isinstance(user_ids, list):
            return Response({'error': 'user_ids must be a list.'}, status=status.HTTP_400_BAD_REQUEST)
            
        from authentication.models import CustomUser
        current_count = shift.assigned_users.count()
        if current_count + len(user_ids) > 10:
            return Response({'error': 'Maximum 10 users per shift.'}, status=status.HTTP_400_BAD_REQUEST)
            
        users = CustomUser.objects.filter(id__in=user_ids)
        shift.assigned_users.add(*users)
        return Response({'detail': 'Users assigned successfully.'})

    @action(detail=True, methods=['get'])
    def shift_analytics(self, request, pk=None):
        shift = self.get_object()
        from pos.models import Order, OrderItem
        from django.db.models import Sum, Count
        from django.db.models.functions import TruncHour
        
        orders = Order.objects.filter(shift=shift, status='completed')
        peak_time_qs = orders.annotate(hour=TruncHour('created_at')).values('hour').annotate(
            order_count=Count('id'), volume=Sum('total_amount')
        ).order_by('hour')
        
        items = OrderItem.objects.filter(order__shift=shift, order__status='completed')
        best_sellers = items.values('product__name').annotate(
            quantity_sold=Sum('quantity'), value=Sum('total_price')
        ).order_by('-quantity_sold')[:5]
        
        txns = SalesTransaction.objects.filter(shift=shift, transaction_type='sale', is_voided=False)
        user_contrib = txns.values('cashier__name').annotate(
            contribution=Sum('net_amount')
        ).order_by('-contribution')
        
        categories = items.values('product__category__name').annotate(
            total_sales=Sum('total_price')
        ).order_by('-total_sales')
        
        return Response({
            'peak_time': list(peak_time_qs),
            'best_sellers': list(best_sellers),
            'user_contribution': list(user_contrib),
            'category_breakdown': list(categories)
        })



class CashMovementViewSet(viewsets.ModelViewSet):
    queryset = CashMovement.objects.all()
    serializer_class = CashMovementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get('shift'):
            qs = qs.filter(shift=self.request.query_params['shift'])
        return qs


class CashDropViewSet(viewsets.ModelViewSet):
    queryset = CashDrop.objects.all()
    serializer_class = CashDropSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        drop = serializer.save(dropped_by=self.request.user)
        # Also create a cash movement record
        CashMovement.objects.create(
            shift=drop.shift,
            movement_type='cash_drop',
            amount=-drop.amount,
            description=f"Cash drop: {drop.note or 'No note'}",
            performed_by=self.request.user,
        )


# ═══════════════════════════════════════════════
#  SALES JOURNAL
# ═══════════════════════════════════════════════

class SalesTransactionViewSet(viewsets.ModelViewSet):
    queryset = SalesTransaction.objects.all()
    serializer_class = SalesTransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get('search'):
            qs = qs.filter(Q(transaction_number__icontains=p['search']) | Q(order__order_number__icontains=p['search']))
        if p.get('transaction_type'):
            qs = qs.filter(transaction_type=p['transaction_type'])
        if p.get('payment_method'):
            qs = qs.filter(payment_method=p['payment_method'])
        if p.get('cashier'):
            qs = qs.filter(cashier=p['cashier'])
        if p.get('date_from'):
            qs = qs.filter(created_at__date__gte=parse_date(p['date_from']))
        if p.get('date_to'):
            qs = qs.filter(created_at__date__lte=parse_date(p['date_to']))
        if p.get('amount_min'):
            qs = qs.filter(net_amount__gte=Decimal(p['amount_min']))
        if p.get('amount_max'):
            qs = qs.filter(net_amount__lte=Decimal(p['amount_max']))
        if p.get('shift'):
            qs = qs.filter(shift=p['shift'])
        return qs

    @action(detail=True, methods=['post'])
    def void(self, request, pk=None):
        """Void a transaction — manager only."""
        txn = self.get_object()
        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response({'error': 'Void reason is required.'}, status=status.HTTP_400_BAD_REQUEST)

        txn.is_voided = True
        txn.void_reason = reason
        txn.voided_by = request.user
        txn.voided_at = timezone.now()
        txn.save()

        # Create a void journal entry
        SalesTransaction.objects.create(
            transaction_type='void',
            order=txn.order,
            shift=txn.shift,
            gross_amount=-txn.gross_amount,
            tax_amount=-txn.tax_amount,
            service_charge=-txn.service_charge,
            net_amount=-txn.net_amount,
            payment_method=txn.payment_method,
            cashier=request.user,
        )

        return Response(SalesTransactionSerializer(txn).data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Summary cards for the sales journal page."""
        p = request.query_params
        qs = self.get_queryset()

        total_sales = qs.filter(transaction_type='sale', is_voided=False).aggregate(t=Sum('net_amount'))['t'] or 0
        total_refunds = qs.filter(transaction_type='refund').aggregate(t=Sum('net_amount'))['t'] or 0
        total_voids = qs.filter(transaction_type='void').aggregate(t=Sum('net_amount'))['t'] or 0
        count = qs.filter(transaction_type='sale', is_voided=False).count()

        return Response({
            'total_sales': total_sales,
            'total_refunds': abs(total_refunds),
            'total_voids': abs(total_voids),
            'net_revenue': total_sales + total_refunds + total_voids,
            'transaction_count': count,
        })


class RefundViewSet(viewsets.ModelViewSet):
    queryset = Refund.objects.all()
    serializer_class = RefundSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        refund = serializer.save(refunded_by=self.request.user)

        # Validate: refund cannot exceed original
        orig = refund.original_transaction
        total_refunded = orig.refunds.aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
        if total_refunded > orig.net_amount:
            refund.delete()
            raise serializers.ValidationError("Total refunds exceed original transaction amount.")

        # Create a refund journal entry
        SalesTransaction.objects.create(
            transaction_type='refund',
            order=orig.order,
            shift=orig.shift,
            gross_amount=-refund.amount,
            net_amount=-refund.amount,
            payment_method=orig.payment_method,
            cashier=self.request.user,
        )


# ═══════════════════════════════════════════════
#  EXPENSE MANAGEMENT
# ═══════════════════════════════════════════════

class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    queryset = ExpenseCategory.objects.all()
    serializer_class = ExpenseCategorySerializer
    permission_classes = [IsAuthenticated]


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get('category'):
            qs = qs.filter(category=p['category'])
        if p.get('status'):
            qs = qs.filter(status=p['status'])
        if p.get('payment_method'):
            qs = qs.filter(payment_method=p['payment_method'])
        if p.get('date_from'):
            qs = qs.filter(date__gte=parse_date(p['date_from']))
        if p.get('date_to'):
            qs = qs.filter(date__lte=parse_date(p['date_to']))
        if p.get('shift'):
            qs = qs.filter(shift=p['shift'])
        return qs

    def perform_create(self, serializer):
        if self.request.user.role not in ['super_admin', 'manager']:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only managers or above can create expenses.")
            
        branch = getattr(self.request.user, 'branch', None)
        shift = None
        if branch:
            shift = CashShift.objects.filter(branch=branch, status='open').first()
            
        serializer.save(created_by=self.request.user, shift=shift)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        expense = self.get_object()
        expense.status = 'approved'
        expense.approved_by = request.user
        expense.approved_at = timezone.now()
        expense.save()
        return Response(ExpenseSerializer(expense).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        expense = self.get_object()
        expense.status = 'rejected'
        expense.save()
        return Response(ExpenseSerializer(expense).data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Monthly budget vs actual by category."""
        from datetime import date
        today = date.today()
        month_start = today.replace(day=1)

        categories = ExpenseCategory.objects.filter(is_active=True)
        result = []
        for cat in categories:
            actual = cat.expenses.filter(
                date__gte=month_start, date__lte=today, status='approved'
            ).aggregate(t=Sum('amount'))['t'] or 0
            result.append({
                'id': str(cat.id),
                'name': cat.name,
                'budget': float(cat.budget_monthly),
                'actual': float(actual),
            })
        return Response(result)


# ═══════════════════════════════════════════════
#  PETTY CASH
# ═══════════════════════════════════════════════

class PettyCashFundViewSet(viewsets.ModelViewSet):
    queryset = PettyCashFund.objects.all()
    serializer_class = PettyCashFundSerializer
    permission_classes = [IsAuthenticated]


class PettyCashTransactionViewSet(viewsets.ModelViewSet):
    queryset = PettyCashTransaction.objects.all()
    serializer_class = PettyCashTransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get('fund'):
            qs = qs.filter(fund=self.request.query_params['fund'])
        return qs

    def create(self, request, *args, **kwargs):
        fund_id = request.data.get('fund')
        txn_type = request.data.get('transaction_type')
        amount = Decimal(str(request.data.get('amount', 0)))

        try:
            fund = PettyCashFund.objects.get(id=fund_id)
        except PettyCashFund.DoesNotExist:
            return Response({'error': 'Fund not found.'}, status=status.HTTP_404_NOT_FOUND)

        if txn_type == 'spend':
            if amount > fund.current_balance:
                return Response({'error': 'Spend exceeds current fund balance.'}, status=status.HTTP_400_BAD_REQUEST)
            fund.current_balance -= amount
        elif txn_type == 'replenish':
            fund.current_balance += amount
        else:
            return Response({'error': 'Invalid transaction type.'}, status=status.HTTP_400_BAD_REQUEST)

        fund.save()

        txn = PettyCashTransaction.objects.create(
            fund=fund,
            transaction_type=txn_type,
            amount=amount,
            purpose=request.data.get('purpose', ''),
            reference=request.data.get('reference', ''),
            receipt_base64=request.data.get('receipt_base64', ''),
            running_balance=fund.current_balance,
            performed_by=request.user,
        )

        return Response(PettyCashTransactionSerializer(txn).data, status=status.HTTP_201_CREATED)


# ═══════════════════════════════════════════════
#  BANK RECONCILIATION
# ═══════════════════════════════════════════════

class BankAccountViewSet(viewsets.ModelViewSet):
    queryset = BankAccount.objects.all()
    serializer_class = BankAccountSerializer
    permission_classes = [IsAuthenticated]


class BankReconciliationViewSet(viewsets.ModelViewSet):
    queryset = BankReconciliation.objects.all()
    serializer_class = BankReconciliationSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'])
    def match_item(self, request, pk=None):
        """Match a system item with a bank item."""
        recon = self.get_object()
        system_item_id = request.data.get('system_item')
        bank_item_id = request.data.get('bank_item')

        try:
            sys_item = BankReconciliationItem.objects.get(id=system_item_id, reconciliation=recon)
            bank_item = BankReconciliationItem.objects.get(id=bank_item_id, reconciliation=recon)
        except BankReconciliationItem.DoesNotExist:
            return Response({'error': 'Item not found.'}, status=status.HTTP_404_NOT_FOUND)

        sys_item.status = 'matched'
        sys_item.matched_with = bank_item
        sys_item.save()

        bank_item.status = 'matched'
        bank_item.matched_with = sys_item
        bank_item.save()

        return Response({'detail': 'Items matched.'})

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Complete reconciliation and lock the period."""
        recon = self.get_object()
        recon.status = 'completed'
        recon.completed_by = request.user
        recon.completed_at = timezone.now()

        # Calculate difference
        matched = recon.items.filter(status='matched')
        unmatched = recon.items.filter(status='unmatched')
        recon.difference = recon.bank_balance - recon.system_balance
        recon.save()

        return Response(BankReconciliationSerializer(recon).data)

    @action(detail=True, methods=['post'])
    def import_csv(self, request, pk=None):
        """Import bank statement items from CSV data (sent as JSON array)."""
        recon = self.get_object()
        rows = request.data.get('items', [])
        created = []
        for row in rows:
            item = BankReconciliationItem.objects.create(
                reconciliation=recon,
                source='bank',
                date=row.get('date'),
                description=row.get('description', ''),
                amount=Decimal(str(row.get('amount', 0))),
            )
            created.append(BankReconciliationItemSerializer(item).data)
        return Response(created, status=status.HTTP_201_CREATED)


# ═══════════════════════════════════════════════
#  CORPORATE INVOICING
# ═══════════════════════════════════════════════

class CorporateClientViewSet(viewsets.ModelViewSet):
    queryset = CorporateClient.objects.all()
    serializer_class = CorporateClientSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get('search'):
            qs = qs.filter(
                Q(company_name__icontains=self.request.query_params['search']) |
                Q(trn__icontains=self.request.query_params['search'])
            )
        return qs


class CorporateInvoiceViewSet(viewsets.ModelViewSet):
    queryset = CorporateInvoice.objects.all().prefetch_related('items', 'payments')
    serializer_class = CorporateInvoiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get('status'):
            qs = qs.filter(status=p['status'])
        if p.get('client'):
            qs = qs.filter(client=p['client'])
        return qs

    def perform_create(self, serializer):
        invoice = serializer.save(created_by=self.request.user)

        # Create line items from request
        items = self.request.data.get('line_items', [])
        subtotal = Decimal('0.00')
        for item_data in items:
            item = CorporateInvoiceItem.objects.create(
                invoice=invoice,
                description=item_data.get('description', ''),
                quantity=Decimal(str(item_data.get('quantity', 1))),
                unit_price=Decimal(str(item_data.get('unit_price', 0))),
            )
            subtotal += item.total_price

        # Calculate totals
        vat_amount = subtotal * (invoice.vat_rate / 100)
        invoice.subtotal = subtotal
        invoice.vat_amount = vat_amount
        invoice.total_amount = subtotal + vat_amount + invoice.service_charge
        invoice.amount_due = invoice.total_amount
        invoice.save()

    @action(detail=True, methods=['post'])
    def record_payment(self, request, pk=None):
        """Record a payment against a corporate invoice."""
        invoice = self.get_object()
        amount = Decimal(str(request.data.get('amount', 0)))

        payment = CorporateInvoicePayment.objects.create(
            invoice=invoice,
            amount=amount,
            payment_method=request.data.get('payment_method', 'bank_transfer'),
            reference=request.data.get('reference', ''),
            date=request.data.get('date', timezone.now().date()),
        )

        invoice.amount_paid += amount
        invoice.amount_due = invoice.total_amount - invoice.amount_paid
        if invoice.amount_due <= 0:
            invoice.status = 'paid'
        invoice.save()

        # Update client outstanding balance
        client = invoice.client
        client.outstanding_balance = client.invoices.exclude(status__in=['paid', 'cancelled']).aggregate(t=Sum('amount_due'))['t'] or 0
        client.save()

        return Response(CorporateInvoiceSerializer(invoice).data)

    @action(detail=True, methods=['post'])
    def send_invoice(self, request, pk=None):
        invoice = self.get_object()
        invoice.status = 'sent'
        invoice.save()
        return Response(CorporateInvoiceSerializer(invoice).data)

    @action(detail=True, methods=['post'])
    def submit_eta(self, request, pk=None):
        """Mark as submitted to Egyptian Tax Authority."""
        invoice = self.get_object()
        invoice.eta_submitted = True
        invoice.eta_submission_date = timezone.now()
        invoice.eta_status = 'submitted'
        invoice.save()
        return Response(CorporateInvoiceSerializer(invoice).data)


class CorporateInvoicePaymentViewSet(viewsets.ModelViewSet):
    queryset = CorporateInvoicePayment.objects.all()
    serializer_class = CorporateInvoicePaymentSerializer
    permission_classes = [IsAuthenticated]


# ═══════════════════════════════════════════════
#  END-OF-DAY REPORT
# ═══════════════════════════════════════════════

class EODReportViewSet(viewsets.ModelViewSet):
    queryset = EODReport.objects.all()
    serializer_class = EODReportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get('branch'):
            qs = qs.filter(branch=p['branch'])
        if p.get('date'):
            qs = qs.filter(report_date=parse_date(p['date']))
        return qs

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Auto-generate an EOD report for a given branch and date."""
        from pos.models import Order, Payment
        from datetime import date as dt_date

        branch_id = request.data.get('branch')
        report_date = parse_date(request.data.get('date', str(dt_date.today())))

        if not branch_id:
            return Response({'error': 'Branch is required to generate EOD.'}, status=status.HTTP_400_BAD_REQUEST)
            
        from authentication.models import Branch
        from django.core.exceptions import ValidationError
        try:
            branch = Branch.objects.get(id=branch_id)
        except (Branch.DoesNotExist, ValidationError):
            return Response({'error': 'A valid branch is required. Superusers without an assigned branch must be assigned one first.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check if already exists
        existing = EODReport.objects.filter(branch_id=branch_id, report_date=report_date).first()
        if existing and existing.is_locked:
            return Response({'error': 'Report for this date is locked.'}, status=status.HTTP_400_BAD_REQUEST)

        # Aggregate from orders
        orders = Order.objects.filter(created_at__date=report_date, status='completed')
        payments = Payment.objects.filter(order__in=orders)

        total_sales = orders.aggregate(t=Sum('total_amount'))['t'] or Decimal('0.00')
        total_discounts = orders.aggregate(t=Sum('discount_amount'))['t'] or Decimal('0.00')
        total_vat = orders.aggregate(t=Sum('tax_amount'))['t'] or Decimal('0.00')
        total_service = orders.aggregate(t=Sum('service_charge'))['t'] or Decimal('0.00')

        # Payment breakdown
        method_breakdown = {}
        for method_row in payments.values('payment_method').annotate(total=Sum('amount')):
            method_breakdown[method_row['payment_method']] = float(method_row['total'])

        cash_sales = Decimal(str(method_breakdown.get('cash', 0)))

        # Refunds & voids from journal
        refunds = SalesTransaction.objects.filter(transaction_type='refund', created_at__date=report_date)
        voids = SalesTransaction.objects.filter(transaction_type='void', created_at__date=report_date)
        total_refunds = abs(refunds.aggregate(t=Sum('net_amount'))['t'] or Decimal('0.00'))
        total_voids_amt = abs(voids.aggregate(t=Sum('net_amount'))['t'] or Decimal('0.00'))

        # Expenses
        expenses = Expense.objects.filter(date=report_date, status='approved')
        total_expenses = expenses.aggregate(t=Sum('amount'))['t'] or Decimal('0.00')

        # Cash from shifts
        shifts = CashShift.objects.filter(opened_at__date=report_date, branch_id=branch_id)
        opening_cash = shifts.aggregate(t=Sum('opening_cash'))['t'] or Decimal('0.00')
        actual_closing = shifts.filter(status='closed').aggregate(t=Sum('actual_closing_cash'))['t'] or Decimal('0.00')
        cash_drops = shifts.aggregate(t=Sum('total_cash_drops'))['t'] or Decimal('0.00')

        cash_exp = expenses.filter(payment_method='cash').aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
        expected_closing = opening_cash + cash_sales - total_refunds - cash_drops - cash_exp

        net_revenue = total_sales - total_refunds - total_voids_amt - total_discounts

        defaults = {
            'total_sales': total_sales,
            'total_refunds': total_refunds,
            'total_voids': total_voids_amt,
            'total_discounts': total_discounts,
            'net_revenue': net_revenue,
            'total_expenses': total_expenses,
            'payment_breakdown': method_breakdown,
            'opening_cash': opening_cash,
            'cash_sales': cash_sales,
            'cash_expenses': cash_exp,
            'cash_drops': cash_drops,
            'expected_closing_cash': expected_closing,
            'actual_closing_cash': actual_closing,
            'cash_discrepancy': actual_closing - expected_closing,
            'total_vat': total_vat,
            'total_service_charge': total_service,
        }

        report, created = EODReport.objects.update_or_create(
            branch_id=branch_id, report_date=report_date, defaults=defaults
        )

        return Response(EODReportSerializer(report).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Lock the EOD report after manager approval."""
        report = self.get_object()
        report.is_locked = True
        report.approved_by = request.user
        report.approved_at = timezone.now()
        report.save()
        return Response(EODReportSerializer(report).data)


# ═══════════════════════════════════════════════
#  FINANCIAL REPORTS AGGREGATE VIEW
# ═══════════════════════════════════════════════

class FinancialReportsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        report_type = request.query_params.get('type', 'pnl')
        date_from = parse_date(request.query_params.get('date_from', '')) or None
        date_to = parse_date(request.query_params.get('date_to', '')) or None

        if report_type == 'pnl':
            return self._pnl(date_from, date_to)
        elif report_type == 'cashflow':
            return self._cashflow(date_from, date_to)
        elif report_type == 'tax':
            return self._tax_summary(date_from, date_to)
        elif report_type == 'sales_analysis':
            return self._sales_analysis(date_from, date_to)
        elif report_type == 'expense_analysis':
            return self._expense_analysis(date_from, date_to)
        return Response({'error': 'Invalid report type.'}, status=status.HTTP_400_BAD_REQUEST)

    def _pnl(self, date_from, date_to):
        from pos.models import Order

        qs = Order.objects.filter(status='completed')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        gross_sales = qs.aggregate(t=Sum('total_amount'))['t'] or 0
        discounts = qs.aggregate(t=Sum('discount_amount'))['t'] or 0

        refunds = SalesTransaction.objects.filter(transaction_type='refund')
        if date_from:
            refunds = refunds.filter(created_at__date__gte=date_from)
        if date_to:
            refunds = refunds.filter(created_at__date__lte=date_to)
        total_refunds = abs(refunds.aggregate(t=Sum('net_amount'))['t'] or 0)

        net_revenue = float(gross_sales) - float(discounts) - float(total_refunds)

        exp_qs = Expense.objects.filter(status='approved')
        if date_from:
            exp_qs = exp_qs.filter(date__gte=date_from)
        if date_to:
            exp_qs = exp_qs.filter(date__lte=date_to)

        expenses_by_cat = list(exp_qs.values('category__name').annotate(total=Sum('amount')).order_by('-total'))
        total_expenses = exp_qs.aggregate(t=Sum('amount'))['t'] or 0

        return Response({
            'gross_sales': float(gross_sales),
            'discounts': float(discounts),
            'refunds': float(total_refunds),
            'net_revenue': net_revenue,
            'expenses_by_category': expenses_by_cat,
            'total_expenses': float(total_expenses),
            'operating_profit': net_revenue - float(total_expenses),
        })

    def _cashflow(self, date_from, date_to):
        from pos.models import Payment

        pay_qs = Payment.objects.all()
        exp_qs = Expense.objects.filter(status='approved')
        if date_from:
            pay_qs = pay_qs.filter(created_at__date__gte=date_from)
            exp_qs = exp_qs.filter(date__gte=date_from)
        if date_to:
            pay_qs = pay_qs.filter(created_at__date__lte=date_to)
            exp_qs = exp_qs.filter(date__lte=date_to)

        cash_in_by_method = list(pay_qs.values('payment_method').annotate(total=Sum('amount')).order_by('-total'))
        total_cash_in = pay_qs.aggregate(t=Sum('amount'))['t'] or 0
        total_cash_out = exp_qs.aggregate(t=Sum('amount'))['t'] or 0

        # Daily chart data
        daily_in = list(pay_qs.annotate(day=TruncDate('created_at')).values('day').annotate(total=Sum('amount')).order_by('day'))
        daily_out = list(exp_qs.annotate(day=TruncDate('date')).values('day').annotate(total=Sum('amount')).order_by('day'))

        return Response({
            'cash_in_by_method': cash_in_by_method,
            'total_cash_in': float(total_cash_in),
            'total_cash_out': float(total_cash_out),
            'net_cash': float(total_cash_in) - float(total_cash_out),
            'daily_in': daily_in,
            'daily_out': daily_out,
        })

    def _tax_summary(self, date_from, date_to):
        from pos.models import Order

        qs = Order.objects.filter(status='completed')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        vat_collected = qs.aggregate(t=Sum('tax_amount'))['t'] or 0
        service_collected = qs.aggregate(t=Sum('service_charge'))['t'] or 0

        return Response({
            'vat_collected': float(vat_collected),
            'service_charge_collected': float(service_collected),
            'total_tax_liability': float(vat_collected) + float(service_collected),
        })

    def _sales_analysis(self, date_from, date_to):
        from pos.models import Order, Payment, OrderItem

        order_qs = Order.objects.filter(status='completed')
        if date_from:
            order_qs = order_qs.filter(created_at__date__gte=date_from)
        if date_to:
            order_qs = order_qs.filter(created_at__date__lte=date_to)

        # Revenue by category
        by_category = list(
            OrderItem.objects.filter(order__in=order_qs)
            .values('product__category__name')
            .annotate(revenue=Sum('total_price'), count=Count('id'))
            .order_by('-revenue')
        )

        # Revenue by payment method
        by_method = list(
            Payment.objects.filter(order__in=order_qs)
            .values('payment_method')
            .annotate(total=Sum('amount'))
            .order_by('-total')
        )

        # Top items by revenue
        top_items = list(
            OrderItem.objects.filter(order__in=order_qs)
            .values('product__name')
            .annotate(revenue=Sum('total_price'), qty=Sum('quantity'))
            .order_by('-revenue')[:10]
        )

        # Average ticket
        total_orders = order_qs.count()
        total_revenue = order_qs.aggregate(t=Sum('total_amount'))['t'] or 0
        avg_ticket = float(total_revenue) / total_orders if total_orders > 0 else 0

        return Response({
            'by_category': by_category,
            'by_payment_method': by_method,
            'top_items': top_items,
            'average_ticket': avg_ticket,
            'total_orders': total_orders,
        })

    def _expense_analysis(self, date_from, date_to):
        exp_qs = Expense.objects.filter(status='approved')
        if date_from:
            exp_qs = exp_qs.filter(date__gte=date_from)
        if date_to:
            exp_qs = exp_qs.filter(date__lte=date_to)

        by_category = list(exp_qs.values('category__name').annotate(total=Sum('amount')).order_by('-total'))

        # Monthly trend
        monthly = list(
            exp_qs.annotate(month=TruncMonth('date'))
            .values('month')
            .annotate(total=Sum('amount'))
            .order_by('month')
        )

        # Budget vs actual (current month)
        from datetime import date as dt_date
        today = dt_date.today()
        month_start = today.replace(day=1)
        budget_data = []
        for cat in ExpenseCategory.objects.filter(is_active=True):
            actual = cat.expenses.filter(date__gte=month_start, date__lte=today, status='approved').aggregate(t=Sum('amount'))['t'] or 0
            budget_data.append({
                'category': cat.name,
                'budget': float(cat.budget_monthly),
                'actual': float(actual),
            })

        return Response({
            'by_category': by_category,
            'monthly_trend': monthly,
            'budget_vs_actual': budget_data,
        })
