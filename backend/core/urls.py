from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('authentication.urls')),
    path('api/settings/', include('settings.urls')),
    path('api/inventory/', include('inventory.urls')),
    path('api/purchasing/', include('purchasing.urls')),
    path('api/pos/', include('pos.urls')),
    path('api/customers/', include('customers.urls')),
    path('api/promotions/', include('promotions.urls')),
    path('api/finance/', include('finance.urls')),
]
