from rest_framework import serializers
from .models import Customer, CustomerPreference, CustomerTab, LoyaltyAccount, TierDefinition

class TierDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TierDefinition
        fields = '__all__'

class CustomerPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerPreference
        fields = ['allergies', 'favorite_order_notes', 'general_notes']

class CustomerTabSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerTab
        fields = ['balance', 'credit_limit', 'is_active']
        read_only_fields = ['balance']

class LoyaltyAccountSerializer(serializers.ModelSerializer):
    current_tier_name = serializers.CharField(source='current_tier.name', read_only=True)
    current_tier_color = serializers.CharField(source='current_tier.color_code', read_only=True)

    class Meta:
        model = LoyaltyAccount
        fields = ['points_balance', 'lifetime_points', 'current_tier', 'current_tier_name', 'current_tier_color']
        read_only_fields = ['points_balance', 'lifetime_points', 'current_tier']

class CustomerSerializer(serializers.ModelSerializer):
    preferences = CustomerPreferenceSerializer(required=False)
    tab = CustomerTabSerializer(read_only=True) # Expose tab data entirely read-only here
    loyalty_account = LoyaltyAccountSerializer(read_only=True) # Expose loyalty read-only here

    class Meta:
        model = Customer
        fields = [
            'id', 'first_name', 'last_name', 'phone', 'email', 'address', 
            'date_of_birth', 'marketing_consent', 'created_at', 'updated_at',
            'preferences', 'tab', 'loyalty_account'
        ]

    def create(self, validated_data):
        preferences_data = validated_data.pop('preferences', None)
        
        # 1. Create Core Customer
        customer = Customer.objects.create(**validated_data)
        
        # 2. Setup Relationships
        if preferences_data:
            CustomerPreference.objects.create(customer=customer, **preferences_data)
        else:
            CustomerPreference.objects.create(customer=customer)
            
        CustomerTab.objects.create(customer=customer)
        LoyaltyAccount.objects.create(customer=customer)
        
        return customer

    def update(self, instance, validated_data):
        preferences_data = validated_data.pop('preferences', None)
        
        # 1. Update Core Customer
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # 2. Update Preferences
        if preferences_data:
            pref, created = CustomerPreference.objects.get_or_create(customer=instance)
            for attr, value in preferences_data.items():
                setattr(pref, attr, value)
            pref.save()
            
        return instance
