from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import LoyaltyRule, Reward, Campaign, Coupon, Referral
from .serializers import (
    LoyaltyRuleSerializer, RewardSerializer, CampaignSerializer, 
    CouponSerializer, ReferralSerializer
)

class LoyaltyRuleViewSet(viewsets.ModelViewSet):
    queryset = LoyaltyRule.objects.all()
    serializer_class = LoyaltyRuleSerializer
    permission_classes = [permissions.IsAuthenticated]

class RewardViewSet(viewsets.ModelViewSet):
    queryset = Reward.objects.all()
    serializer_class = RewardSerializer
    permission_classes = [permissions.IsAuthenticated]

class CampaignViewSet(viewsets.ModelViewSet):
    queryset = Campaign.objects.all()
    serializer_class = CampaignSerializer
    permission_classes = [permissions.IsAuthenticated]

class CouponViewSet(viewsets.ModelViewSet):
    queryset = Coupon.objects.all()
    serializer_class = CouponSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['code']
    filterset_fields = ['is_active']

class ReferralViewSet(viewsets.ModelViewSet):
    queryset = Referral.objects.select_related('referrer').all()
    serializer_class = ReferralSerializer
    permission_classes = [permissions.IsAuthenticated]
