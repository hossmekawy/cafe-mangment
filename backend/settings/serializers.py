from rest_framework import serializers
from .models import GlobalSettings, OrderCancelReason

class GlobalSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = GlobalSettings
        fields = '__all__'

class OrderCancelReasonSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderCancelReason
        fields = '__all__'
