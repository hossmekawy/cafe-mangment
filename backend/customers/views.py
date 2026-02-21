from rest_framework import viewsets, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Max, Count
from pos.models import Order
from .models import Customer, TierDefinition
from .serializers import CustomerSerializer, TierDefinitionSerializer

class TierDefinitionViewSet(viewsets.ModelViewSet):
    queryset = TierDefinition.objects.all().order_by('required_points')
    serializer_class = TierDefinitionSerializer
    permission_classes = [permissions.IsAuthenticated]

class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.select_related(
        'preferences', 'tab', 'loyalty_account', 'loyalty_account__current_tier'
    ).all().order_by('-created_at')
    
    serializer_class = CustomerSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['first_name', 'last_name', 'phone', 'email']
    filterset_fields = ['marketing_consent']

    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        customer = self.get_object()
        
        orders = Order.objects.filter(customer=customer, status='completed')
        
        stats = orders.aggregate(
            total_visits=Count('id'),
            total_spent=Sum('total_amount'),
            last_visit=Max('created_at')
        )
        
        # Get recent orders
        recent_orders = orders.order_by('-created_at')[:5].values(
            'order_number', 'total_amount', 'created_at', 'order_type'
        )
        
        return Response({
            'total_visits': stats['total_visits'] or 0,
            'total_spent': stats['total_spent'] or 0.00,
            'last_visit': stats['last_visit'],
            'recent_orders': list(recent_orders),
            'tab_balance': customer.tab.balance if hasattr(customer, 'tab') else 0.00,
            'loyalty_points': customer.loyalty_account.points_balance if hasattr(customer, 'loyalty_account') else 0.00
        })
