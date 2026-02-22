import datetime
from django.utils import timezone
from django.db.models import Sum, Count, Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse

from .services import generate_pdf, generate_excel
from pos.models import Order, OrderItem
from inventory.models import RawMaterial, WasteLog
from finance.models import Expense
from customers.models import Customer
from authentication.models import CustomUser

class BaseReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get_date_range(self, request):
        start = request.query_params.get('start_date')
        end = request.query_params.get('end_date')
        
        # default to this month
        today = timezone.now().date()
        if not start:
            start_date = today.replace(day=1)
        else:
            start_date = datetime.datetime.strptime(start, '%Y-%m-%d').date()
            
        if not end:
            end_date = today
        else:
            end_date = datetime.datetime.strptime(end, '%Y-%m-%d').date()
            
        return start_date, end_date

    def handle_export(self, request, data_list, columns, template_name, context, filename):
        fmt = request.query_params.get('format', 'json')
        lang = request.query_params.get('lang', 'en')
        
        # Add brand and date context variables for PDF
        try:
            from settings.models import GlobalSettings
            settings_obj = GlobalSettings.load()
            context['brand_name'] = settings_obj.brand_name
            context['logo_base64'] = settings_obj.logo_base64
        except Exception:
            context['brand_name'] = 'Qodix.ai'
            context['logo_base64'] = None
            
        context['current_time'] = timezone.now().strftime('%Y-%m-%d %H:%M')

        if fmt == 'pdf':
            pdf_bytes = generate_pdf(template_name, context, lang)
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}.pdf"'
            return response
            
        elif fmt == 'excel':
            excel_bytes = generate_excel(data_list, columns, filename)
            response = HttpResponse(excel_bytes, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            response['Content-Disposition'] = f'attachment; filename="{filename}.xlsx"'
            return response
            
        # JSON default
        return Response({"success": True, "data": data_list, "summary": context.get('summary', {})})


class SalesReportView(BaseReportView):
    def get(self, request):
        start_date, end_date = self.get_date_range(request)
        
        # Filters
        employee_id = request.query_params.get('employee_id')
        customer_id = request.query_params.get('customer_id')

        qs = Order.objects.filter(status='completed', created_at__date__gte=start_date, created_at__date__lte=end_date)
        if employee_id:
            qs = qs.filter(assigned_waiter_id=employee_id)
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        orders = qs.select_related('assigned_waiter', 'customer')
        
        data_list = []
        total_revenue = 0
        
        for o in orders:
            waiter_name = o.assigned_waiter.name if o.assigned_waiter else 'N/A'
            cust_name = f"{o.customer.first_name} {o.customer.last_name}" if o.customer else 'Guest'
            total_revenue += float(o.total_amount)
            
            data_list.append({
                'Order ID': o.order_number,
                'Date': o.created_at.strftime('%Y-%m-%d %H:%M'),
                'Customer': cust_name,
                'Employee': waiter_name,
                'Type': o.order_type,
                'Total': float(o.total_amount),
            })
            
        context = {
            'title': 'Sales Report',
            'start_date': start_date,
            'end_date': end_date,
            'orders': data_list,
            'summary': {
                'total_orders': len(data_list),
                'total_revenue': total_revenue
            }
        }
        
        columns = ['Order ID', 'Date', 'Customer', 'Employee', 'Type', 'Total']
        return self.handle_export(request, data_list, columns, 'reports/sales_report.html', context, 'Sales_Report')


class InventoryReportView(BaseReportView):
    def get(self, request):
        qs = RawMaterial.objects.filter(is_active=True).select_related('unit')
        
        data_list = []
        total_value = 0
        
        for rm in qs:
            val = float(rm.current_stock * rm.cost_per_unit)
            total_value += val
            data_list.append({
                'Material': rm.name,
                'Stock': float(rm.current_stock),
                'Unit': rm.unit.name if rm.unit else '',
                'Min Stock': float(rm.minimum_stock),
                'Cost/Unit': float(rm.cost_per_unit),
                'Total Value': val,
                'Status': 'Low Stock' if rm.current_stock <= rm.minimum_stock else 'OK'
            })
            
        context = {
            'title': 'Inventory Stock Report',
            'date': timezone.now().strftime('%Y-%m-%d'),
            'inventory': data_list,
            'summary': {
                'total_items': len(data_list),
                'total_value': total_value
            }
        }
        
        columns = ['Material', 'Stock', 'Unit', 'Min Stock', 'Cost/Unit', 'Total Value', 'Status']
        return self.handle_export(request, data_list, columns, 'reports/inventory_report.html', context, 'Inventory_Report')


class CustomerReportView(BaseReportView):
    def get(self, request):
        # Top customers by spending
        start_date, end_date = self.get_date_range(request)
        
        customers = Customer.objects.annotate(
            total_spent=Sum('orders__total_amount', filter=Q(orders__status='completed', orders__created_at__date__gte=start_date, orders__created_at__date__lte=end_date)),
            orders_count=Count('orders', filter=Q(orders__status='completed', orders__created_at__date__gte=start_date, orders__created_at__date__lte=end_date))
        ).filter(total_spent__gt=0).order_by('-total_spent')[:50]
        
        data_list = []
        for c in customers:
            data_list.append({
                'Name': f"{c.first_name} {c.last_name or ''}".strip(),
                'Phone': c.phone,
                'Total Orders': c.orders_count,
                'Total Spent': float(c.total_spent or 0)
            })
            
        context = {
            'title': 'Customer Activity Report',
            'start_date': start_date,
            'end_date': end_date,
            'customers': data_list,
            'summary': {
                'active_customers': len(data_list)
            }
        }
        
        columns = ['Name', 'Phone', 'Total Orders', 'Total Spent']
        return self.handle_export(request, data_list, columns, 'reports/customer_report.html', context, 'Customer_Report')


class FinancialReportView(BaseReportView):
    def get(self, request):
        start_date, end_date = self.get_date_range(request)
        
        # Revenue
        revenue = Order.objects.filter(status='completed', created_at__date__gte=start_date, created_at__date__lte=end_date).aggregate(t=Sum('total_amount'))['t'] or 0
        
        # Expenses
        expenses = Expense.objects.filter(date__gte=start_date, date__lte=end_date).aggregate(t=Sum('amount'))['t'] or 0
        
        # Waste
        waste = WasteLog.objects.filter(created_at__date__gte=start_date, created_at__date__lte=end_date).aggregate(t=Sum('cost_value'))['t'] or 0
        
        profit = float(revenue) - float(expenses) - float(waste)
        
        data_list = [
            {'Category': 'Sales Revenue', 'Amount': float(revenue)},
            {'Category': 'Total Expenses', 'Amount': float(expenses)},
            {'Category': 'Waste Cost', 'Amount': float(waste)},
            {'Category': 'Net Profit/Loss', 'Amount': float(profit)},
        ]
        
        context = {
            'title': 'Financial Summary (Income Statement)',
            'start_date': start_date,
            'end_date': end_date,
            'financials': data_list,
            'summary': {
                'revenue': float(revenue),
                'expenses': float(expenses),
                'waste': float(waste),
                'profit': float(profit)
            }
        }
        
        columns = ['Category', 'Amount']
        return self.handle_export(request, data_list, columns, 'reports/financial_report.html', context, 'Financial_Report')
