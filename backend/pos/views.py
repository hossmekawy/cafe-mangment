from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Sum, Count
from django.db.models.functions import TruncDate
from django.utils.dateparse import parse_date

from .models import ModifierGroup, Modifier, Table, Order, OrderItem, Payment
from inventory.models import Product
from .serializers import (
    ModifierGroupSerializer, ModifierSerializer, TableSerializer,
    POSProductSerializer, OrderSerializer, OrderCreateSerializer, PaymentSerializer,
    OrderItemSerializer
)

class POSProductViewSet(viewsets.ReadOnlyModelViewSet):
    """ Read-only list of available products for the POS grid with pre-fetched modifiers """
    queryset = Product.objects.filter(availability_status='available').prefetch_related(
        'modifier_groups__modifiers', 'variations', 'combo_items', 'combo_items__child_product', 'category'
    )
    serializer_class = POSProductSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Only return products that have no category OR their category has show_in_pos=True
        queryset = super().get_queryset().filter(
            Q(category__isnull=True) | Q(category__show_in_pos=True)
        )
        category = self.request.query_params.get('category', None)
        if category:
            queryset = queryset.filter(category=category)
        return queryset

class TableViewSet(viewsets.ModelViewSet):
    queryset = Table.objects.all().order_by('number')
    serializer_class = TableSerializer
    permission_classes = [IsAuthenticated]

class ModifierGroupViewSet(viewsets.ModelViewSet):
    queryset = ModifierGroup.objects.all().prefetch_related('modifiers')
    serializer_class = ModifierGroupSerializer
    permission_classes = [IsAuthenticated]

class ModifierViewSet(viewsets.ModelViewSet):
    queryset = Modifier.objects.all()
    serializer_class = ModifierSerializer
    permission_classes = [IsAuthenticated]

class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all().prefetch_related('items__modifiers', 'payments').order_by('-created_at')
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return OrderCreateSerializer
        return OrderSerializer

    def get_queryset(self):
        """Support comprehensive filtering via query params."""
        queryset = super().get_queryset()
        params = self.request.query_params

        # Text search: order number, customer name, customer phone
        search = params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(order_number__icontains=search) |
                Q(customer__first_name__icontains=search) |
                Q(customer__last_name__icontains=search) |
                Q(customer__phone__icontains=search)
            )

        # Status filter
        order_status = params.get('status', '')
        if order_status:
            queryset = queryset.filter(status=order_status)

        # Order type filter
        order_type = params.get('order_type', '')
        if order_type:
            queryset = queryset.filter(order_type=order_type)

        # Payment status filter
        is_paid = params.get('is_paid', '')
        if is_paid == 'true':
            queryset = queryset.filter(is_paid=True)
        elif is_paid == 'false':
            queryset = queryset.filter(is_paid=False)

        # Date range filter
        date_from = params.get('date_from', '')
        date_to = params.get('date_to', '')
        if date_from:
            parsed = parse_date(date_from)
            if parsed:
                queryset = queryset.filter(created_at__date__gte=parsed)
        if date_to:
            parsed = parse_date(date_to)
            if parsed:
                queryset = queryset.filter(created_at__date__lte=parsed)

        return queryset
        
    def perform_create(self, serializer):
        serializer.save(assigned_waiter=self.request.user)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel an order with a mandatory reason."""
        order = self.get_object()
        reason = request.data.get('reason', '').strip()

        if not reason:
            return Response({'error': 'A cancellation reason is required.'}, status=status.HTTP_400_BAD_REQUEST)

        if order.status == 'cancelled':
            return Response({'error': 'Order is already cancelled.'}, status=status.HTTP_400_BAD_REQUEST)

        order.status = 'cancelled'
        order.cancel_reason = reason
        order.save()

        # Free up table if dine-in
        if order.table:
            order.table.status = 'available'
            order.table.save()

        serializer = OrderSerializer(order)
        return Response({'success': True, 'order': serializer.data})

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Returns daily revenue and order count aggregates for charts (last 30 days)."""
        from django.utils import timezone
        from datetime import timedelta

        since = timezone.now() - timedelta(days=30)

        daily = (
            Order.objects
            .filter(created_at__gte=since, status='completed')
            .annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(
                revenue=Sum('total_amount'),
                count=Count('id', distinct=True)
            )
            .order_by('day')
        )

        # Quick totals
        totals = Order.objects.filter(status='completed').aggregate(
            total_revenue=Sum('total_amount')
        )
        total_orders = Order.objects.count()
        cancelled_orders = Order.objects.filter(status='cancelled').count()
        pending_orders = Order.objects.filter(status='pending').count()

        # Orders by type
        by_type = {}
        for t in ['dine_in', 'takeaway', 'delivery']:
            by_type[t] = Order.objects.filter(order_type=t, status='completed').count()

        return Response({
            'daily': list(daily),
            'total_revenue': totals['total_revenue'] or 0,
            'total_orders': total_orders,
            'cancelled_orders': cancelled_orders,
            'pending_orders': pending_orders,
            'by_type': by_type,
        })
        
    @action(detail=True, methods=['post'])
    def process_payment(self, request, pk=None):
        order = self.get_object()
        
        payments_data = request.data.get('payments', [])
        redeemed_points = request.data.get('redeemed_points', 0)
        
        # Backward compatibility for existing single payment requests
        if not payments_data:
            amount = request.data.get('amount')
            method = request.data.get('payment_method')
            if amount and method:
                payments_data = [{'amount': amount, 'method': method}]
                
        if not payments_data:
            return Response({"error": "Payment details are required."}, status=status.HTTP_400_BAD_REQUEST)
            
        # 1. Handle Point Redemption
        if int(redeemed_points) > 0 and order.customer:
            loyalty_acc = getattr(order.customer, 'loyalty_account', None)
            if loyalty_acc and float(loyalty_acc.points_balance) >= float(redeemed_points):
                from promotions.models import Reward
                loyalty_acc.points_balance -= int(redeemed_points)
                loyalty_acc.save()
            else:
                return Response({"error": "Insufficient points balance."}, status=status.HTTP_400_BAD_REQUEST)
                
        # 2. Record Payments
        for payment in payments_data:
            amt = payment.get('amount')
            method = payment.get('method') or payment.get('payment_method')
            
            if not amt or not method:
                continue
                
            Payment.objects.create(
                order=order,
                amount=amt,
                payment_method=method,
                processed_by=request.user
            )
        
        order.is_paid = True
        order.save()
        
        # 3. Fire POS Services (Stock Deduction + Loyalty Earn + Tab)
        from .services import complete_order
        success, msg = complete_order(order.id, request.user)
        if not success:
            return Response({"error": f"Payment logged, but completion failed: {msg}"}, status=status.HTTP_400_BAD_REQUEST)
        
        # 4. Free up the table if dine-in
        if order.table:
            order.table.status = 'needs_cleaning'
            order.table.save()
            
        return Response({"success": True})

class OrderItemViewSet(viewsets.ModelViewSet):
    """
    Specifically for the Kitchen Display System (KDS)
    """
    queryset = OrderItem.objects.all().order_by('created_at')
    serializer_class = OrderItemSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        station = self.request.query_params.get('station', None)
        status = self.request.query_params.get('status', 'pending,preparing')
        
        if station:
            queryset = queryset.filter(prep_station=station)
            
        if status:
            status_list = status.split(',')
            queryset = queryset.filter(status__in=status_list)
            
        return queryset

    @action(detail=True, methods=['post'])
    def bump_status(self, request, pk=None):
        item = self.get_object()
        new_status = request.data.get('status')
        
        if new_status in [choice[0] for choice in OrderItem.STATUS_CHOICES]:
            item.status = new_status
            if new_status == 'ready':
                from django.utils import timezone
                item.ready_at = timezone.now()
            item.save()
            return Response({"success": True, "new_status": item.status})
        else:
            return Response({"error": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)
