from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum, Count, Avg, Q, F
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)
        month_start = today.replace(day=1)

        data = {}

        # ──────────────── SALES SUMMARY ────────────────
        data['sales_summary'] = self._get_sales_summary(today, week_ago, month_start)

        # ──────────────── REVENUE CHART (30 days) ────────────────
        data['revenue_chart'] = self._get_revenue_chart(month_ago, today)

        # ──────────────── ORDER STATUS ────────────────
        data['recent_orders'] = self._get_recent_orders()

        # ──────────────── ORDER STATUS COUNTS ────────────────
        data['order_status_counts'] = self._get_order_status_counts(today)

        # ──────────────── TOP PRODUCTS ────────────────
        data['top_products'] = self._get_top_products(month_ago)

        # ──────────────── PAYMENT BREAKDOWN ────────────────
        data['payment_breakdown'] = self._get_payment_breakdown(today)

        # ──────────────── INVENTORY ALERTS ────────────────
        data['inventory_alerts'] = self._get_inventory_alerts()

        # ──────────────── CUSTOMER DEBTS ────────────────
        data['customer_debts'] = self._get_customer_debts()

        # ──────────────── EXPENSES ────────────────
        data['expenses'] = self._get_expenses(today, month_start)

        # ──────────────── PROFIT / LOSS ────────────────
        data['profit_loss'] = self._get_profit_loss(today, month_start)

        # ──────────────── PENDING SUPPLIER INVOICES ────────────────
        data['pending_invoices'] = self._get_pending_invoices()

        # ──────────────── STAFF OVERVIEW ────────────────
        data['staff_overview'] = self._get_staff_overview()

        # ──────────────── ACTIVE PROMOTIONS ────────────────
        data['active_promotions'] = self._get_active_promotions()

        # ──────────────── HOURLY SALES (today) ────────────────
        data['hourly_sales'] = self._get_hourly_sales(today)

        # ──────────────── ORDER TYPES BREAKDOWN ────────────────
        data['order_types'] = self._get_order_types(today)

        return Response(data)

    # ═══════════════════════════════════════════════════════════════
    #  HELPER METHODS
    # ═══════════════════════════════════════════════════════════════

    def _get_sales_summary(self, today, week_ago, month_start):
        from pos.models import Order

        def agg(qs):
            result = qs.filter(status='completed').aggregate(
                revenue=Sum('total_amount'),
                count=Count('id'),
                avg_order=Avg('total_amount'),
            )
            return {
                'revenue': float(result['revenue'] or 0),
                'count': result['count'] or 0,
                'avg_order': round(float(result['avg_order'] or 0), 2),
            }

        today_data = agg(Order.objects.filter(created_at__date=today))
        week_data = agg(Order.objects.filter(created_at__date__gte=week_ago))
        month_data = agg(Order.objects.filter(created_at__date__gte=month_start))

        # Yesterday comparison for trend
        yesterday = today - timedelta(days=1)
        yesterday_revenue = float(
            Order.objects.filter(
                created_at__date=yesterday, status='completed'
            ).aggregate(r=Sum('total_amount'))['r'] or 0
        )
        today_rev = today_data['revenue']
        if yesterday_revenue > 0:
            trend_pct = round(((today_rev - yesterday_revenue) / yesterday_revenue) * 100, 1)
        else:
            trend_pct = 100.0 if today_rev > 0 else 0.0

        return {
            'today': today_data,
            'week': week_data,
            'month': month_data,
            'trend_pct': trend_pct,
        }

    def _get_revenue_chart(self, start_date, end_date):
        from pos.models import Order

        qs = (
            Order.objects
            .filter(status='completed', created_at__date__gte=start_date, created_at__date__lte=end_date)
            .annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(revenue=Sum('total_amount'), orders=Count('id'))
            .order_by('day')
        )

        # Build a full 30-day array (including zero days)
        chart = []
        current = start_date
        revenue_map = {item['day']: item for item in qs}
        while current <= end_date:
            entry = revenue_map.get(current, {})
            chart.append({
                'date': current.isoformat(),
                'revenue': float(entry.get('revenue', 0)),
                'orders': entry.get('orders', 0),
            })
            current += timedelta(days=1)

        return chart

    def _get_recent_orders(self):
        from pos.models import Order

        orders = (
            Order.objects
            .select_related('customer', 'assigned_waiter', 'table')
            .order_by('-created_at')[:15]
        )
        return [
            {
                'id': str(o.id),
                'order_number': o.order_number,
                'status': o.status,
                'order_type': o.order_type,
                'total_amount': float(o.total_amount),
                'is_paid': o.is_paid,
                'customer_name': f"{o.customer.first_name} {o.customer.last_name or ''}" if o.customer else None,
                'waiter': o.assigned_waiter.name if o.assigned_waiter else None,
                'table': o.table.number if o.table else None,
                'created_at': o.created_at.isoformat(),
            }
            for o in orders
        ]

    def _get_order_status_counts(self, today):
        from pos.models import Order

        qs = Order.objects.filter(created_at__date=today)
        return {
            'pending': qs.filter(status='pending').count(),
            'completed': qs.filter(status='completed').count(),
            'cancelled': qs.filter(status='cancelled').count(),
        }

    def _get_top_products(self, since_date):
        from pos.models import OrderItem

        items = (
            OrderItem.objects
            .filter(order__status='completed', order__created_at__date__gte=since_date)
            .values('product__name')
            .annotate(
                total_qty=Sum('quantity'),
                total_revenue=Sum('total_price'),
            )
            .order_by('-total_qty')[:10]
        )
        return [
            {
                'name': i['product__name'],
                'quantity': i['total_qty'],
                'revenue': float(i['total_revenue'] or 0),
            }
            for i in items
        ]

    def _get_payment_breakdown(self, today):
        from pos.models import Payment

        methods = (
            Payment.objects
            .filter(created_at__date=today)
            .values('payment_method')
            .annotate(total=Sum('amount'), count=Count('id'))
            .order_by('-total')
        )
        return [
            {
                'method': m['payment_method'],
                'total': float(m['total'] or 0),
                'count': m['count'],
            }
            for m in methods
        ]

    def _get_inventory_alerts(self):
        from inventory.models import RawMaterial

        low_stock = list(
            RawMaterial.objects
            .filter(is_active=True, current_stock__gt=0, current_stock__lte=F('minimum_stock'))
            .values('name', 'current_stock', 'minimum_stock', 'unit__name')
            .order_by('current_stock')[:15]
        )
        out_of_stock = list(
            RawMaterial.objects
            .filter(is_active=True, current_stock__lte=0)
            .values('name', 'unit__name')
            .order_by('name')[:15]
        )

        for item in low_stock:
            item['current_stock'] = float(item['current_stock'])
            item['minimum_stock'] = float(item['minimum_stock'])

        return {
            'low_stock': low_stock,
            'out_of_stock': out_of_stock,
            'low_stock_count': RawMaterial.objects.filter(
                is_active=True, current_stock__gt=0, current_stock__lte=F('minimum_stock')
            ).count(),
            'out_of_stock_count': RawMaterial.objects.filter(
                is_active=True, current_stock__lte=0
            ).count(),
        }

    def _get_customer_debts(self):
        from customers.models import CustomerTab

        tabs = (
            CustomerTab.objects
            .filter(balance__gt=0, is_active=True)
            .select_related('customer')
            .order_by('-balance')[:10]
        )
        total_debt = float(
            CustomerTab.objects.filter(balance__gt=0, is_active=True)
            .aggregate(total=Sum('balance'))['total'] or 0
        )
        return {
            'total_debt': total_debt,
            'count': CustomerTab.objects.filter(balance__gt=0, is_active=True).count(),
            'top_debtors': [
                {
                    'customer_name': f"{t.customer.first_name} {t.customer.last_name or ''}".strip(),
                    'phone': t.customer.phone,
                    'balance': float(t.balance),
                    'credit_limit': float(t.credit_limit),
                }
                for t in tabs
            ],
        }

    def _get_expenses(self, today, month_start):
        from finance.models import Expense

        today_expenses = float(
            Expense.objects.filter(date=today)
            .aggregate(total=Sum('amount'))['total'] or 0
        )
        month_expenses = float(
            Expense.objects.filter(date__gte=month_start)
            .aggregate(total=Sum('amount'))['total'] or 0
        )

        # Expense by category this month
        by_category = list(
            Expense.objects
            .filter(date__gte=month_start)
            .values('category')
            .annotate(total=Sum('amount'))
            .order_by('-total')[:8]
        )
        for c in by_category:
            c['total'] = float(c['total'])

        return {
            'today': today_expenses,
            'month': month_expenses,
            'by_category': by_category,
        }

    def _get_profit_loss(self, today, month_start):
        from pos.models import Order
        from finance.models import Expense
        from inventory.models import WasteLog

        # Revenue
        today_revenue = float(
            Order.objects.filter(created_at__date=today, status='completed')
            .aggregate(r=Sum('total_amount'))['r'] or 0
        )
        month_revenue = float(
            Order.objects.filter(created_at__date__gte=month_start, status='completed')
            .aggregate(r=Sum('total_amount'))['r'] or 0
        )

        # Expenses
        today_expenses = float(
            Expense.objects.filter(date=today)
            .aggregate(t=Sum('amount'))['t'] or 0
        )
        month_expenses = float(
            Expense.objects.filter(date__gte=month_start)
            .aggregate(t=Sum('amount'))['t'] or 0
        )

        # Waste
        today_waste = float(
            WasteLog.objects.filter(created_at__date=today)
            .aggregate(t=Sum('cost_value'))['t'] or 0
        )
        month_waste = float(
            WasteLog.objects.filter(created_at__date__gte=month_start)
            .aggregate(t=Sum('cost_value'))['t'] or 0
        )

        today_profit = today_revenue - today_expenses - today_waste
        month_profit = month_revenue - month_expenses - month_waste

        return {
            'today': {
                'revenue': today_revenue,
                'expenses': today_expenses,
                'waste': today_waste,
                'profit': today_profit,
            },
            'month': {
                'revenue': month_revenue,
                'expenses': month_expenses,
                'waste': month_waste,
                'profit': month_profit,
            },
        }

    def _get_pending_invoices(self):
        from purchasing.models import SupplierInvoice

        unpaid = SupplierInvoice.objects.filter(status__in=['unpaid', 'overdue'])
        total_amount = float(
            unpaid.aggregate(t=Sum('total_amount'))['t'] or 0
        )
        overdue_count = unpaid.filter(status='overdue').count()

        invoices = list(
            unpaid
            .select_related('supplier')
            .order_by('due_date')
            .values(
                'invoice_number', 'supplier__name', 'total_amount',
                'paid_amount', 'status', 'due_date'
            )[:10]
        )
        for inv in invoices:
            inv['total_amount'] = float(inv['total_amount'])
            inv['paid_amount'] = float(inv['paid_amount'])

        return {
            'count': unpaid.count(),
            'overdue_count': overdue_count,
            'total_amount': total_amount,
            'invoices': invoices,
        }

    def _get_staff_overview(self):
        from authentication.models import CustomUser

        staff = (
            CustomUser.objects
            .filter(is_active=True)
            .values('role')
            .annotate(count=Count('id'))
            .order_by('role')
        )
        return {
            'total': CustomUser.objects.filter(is_active=True).count(),
            'by_role': list(staff),
        }

    def _get_active_promotions(self):
        from promotions.models import Campaign, Coupon

        now = timezone.now()
        active_campaigns = Campaign.objects.filter(
            is_active=True
        ).filter(
            Q(start_date__lte=now) | Q(start_date__isnull=True),
            Q(end_date__gte=now) | Q(end_date__isnull=True),
        ).count()

        active_coupons = Coupon.objects.filter(is_active=True).filter(
            Q(expiry_date__gte=now) | Q(expiry_date__isnull=True)
        ).count()

        return {
            'campaigns': active_campaigns,
            'coupons': active_coupons,
        }

    def _get_hourly_sales(self, today):
        from pos.models import Order
        from django.db.models.functions import ExtractHour

        qs = (
            Order.objects
            .filter(created_at__date=today, status='completed')
            .annotate(hour=ExtractHour('created_at'))
            .values('hour')
            .annotate(revenue=Sum('total_amount'), orders=Count('id'))
            .order_by('hour')
        )

        # Build full 24-hour array
        hour_map = {item['hour']: item for item in qs}
        return [
            {
                'hour': h,
                'label': f"{h:02d}:00",
                'revenue': float(hour_map.get(h, {}).get('revenue', 0)),
                'orders': hour_map.get(h, {}).get('orders', 0),
            }
            for h in range(24)
        ]

    def _get_order_types(self, today):
        from pos.models import Order

        types = (
            Order.objects
            .filter(created_at__date=today, status='completed')
            .values('order_type')
            .annotate(count=Count('id'), total=Sum('total_amount'))
            .order_by('-count')
        )
        return [
            {
                'type': t['order_type'],
                'count': t['count'],
                'total': float(t['total'] or 0),
            }
            for t in types
        ]
