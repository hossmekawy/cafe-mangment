from django.contrib import admin
from .models import LoyaltyRule, Reward, Campaign, Coupon, Referral

@admin.register(LoyaltyRule)
class LoyaltyRuleAdmin(admin.ModelAdmin):
    list_display = ('name', 'spend_amount', 'points_earned', 'is_active')
    list_filter = ('is_active',)

@admin.register(Reward)
class RewardAdmin(admin.ModelAdmin):
    list_display = ('name', 'points_cost', 'discount_value', 'is_percentage', 'is_active')
    list_filter = ('is_active', 'is_percentage')

@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = ('name', 'start_date', 'end_date', 'discount_percentage', 'is_active')
    list_filter = ('is_active', 'start_date', 'end_date')

@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ('code', 'discount_value', 'is_percentage', 'usage_limit', 'times_used', 'expiry_date', 'is_active')
    search_fields = ('code',)
    list_filter = ('is_active', 'is_percentage', 'expiry_date')

@admin.register(Referral)
class ReferralAdmin(admin.ModelAdmin):
    list_display = ('referrer', 'referred_phone', 'status', 'created_at', 'completed_at')
    list_filter = ('status', 'created_at')
    search_fields = ('referred_phone', 'referrer__phone')
