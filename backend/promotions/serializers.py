from rest_framework import serializers
from .models import LoyaltyRule, Reward, Campaign, Coupon, Referral

class LoyaltyRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltyRule
        fields = '__all__'

class RewardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reward
        fields = '__all__'

class CampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campaign
        fields = '__all__'

class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = '__all__'
        read_only_fields = ['times_used']

class ReferralSerializer(serializers.ModelSerializer):
    referrer_phone = serializers.CharField(source='referrer.phone', read_only=True)

    class Meta:
        model = Referral
        fields = '__all__'
        read_only_fields = ['status', 'completed_at']
