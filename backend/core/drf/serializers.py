from rest_framework import serializers
from core.domain.models import Patient, Encounter, Observation, Provider, MedicationOrder, LabResult

class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = "__all__"

class ProviderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Provider
        fields = "__all__"

class EncounterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Encounter
        fields = "__all__"

class ObservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Observation
        fields = "__all__"

class MedicationOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicationOrder
        fields = "__all__"

class LabResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabResult
        fields = "__all__"
