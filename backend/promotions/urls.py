from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LoyaltyRuleViewSet, RewardViewSet, CampaignViewSet, 
    CouponViewSet, ReferralViewSet
)

router = DefaultRouter()
router.register(r'loyalty-rules', LoyaltyRuleViewSet)
router.register(r'rewards', RewardViewSet)
router.register(r'campaigns', CampaignViewSet)
router.register(r'coupons', CouponViewSet)
router.register(r'referrals', ReferralViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
