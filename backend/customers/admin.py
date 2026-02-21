from django.contrib import admin
from .models import Customer, CustomerPreference, CustomerTab, LoyaltyAccount, TierDefinition

class CustomerPreferenceInline(admin.StackedInline):
    model = CustomerPreference
    can_delete = False

class CustomerTabInline(admin.StackedInline):
    model = CustomerTab
    can_delete = False

class LoyaltyAccountInline(admin.StackedInline):
    model = LoyaltyAccount
    can_delete = False

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'phone', 'email', 'marketing_consent', 'created_at')
    search_fields = ('first_name', 'last_name', 'phone', 'email')
    list_filter = ('marketing_consent', 'created_at')
    inlines = [CustomerPreferenceInline, CustomerTabInline, LoyaltyAccountInline]

@admin.register(TierDefinition)
class TierDefinitionAdmin(admin.ModelAdmin):
    list_display = ('name', 'required_points', 'discount_percentage')
    search_fields = ('name',)
