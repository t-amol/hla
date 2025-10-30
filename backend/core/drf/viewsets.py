from rest_framework import viewsets, filters
from core.domain.models import Patient, Provider, Encounter, Observation, MedicationOrder, LabResult
from .serializers import (
    PatientSerializer, ProviderSerializer, EncounterSerializer,
    ObservationSerializer, MedicationOrderSerializer, LabResultSerializer
)

class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all().order_by("patient_id")
    serializer_class = PatientSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["first_name","last_name","address"]

class ProviderViewSet(viewsets.ModelViewSet):
    queryset = Provider.objects.all().order_by("provider_id")
    serializer_class = ProviderSerializer

class EncounterViewSet(viewsets.ModelViewSet):
    queryset = Encounter.objects.select_related("patient").all().order_by("encounter_id")
    serializer_class = EncounterSerializer
    filterset_fields = ["patient__patient_id","encounter_type"]

class ObservationViewSet(viewsets.ModelViewSet):
    queryset = Observation.objects.select_related("patient").all().order_by("effective_time")
    serializer_class = ObservationSerializer
    filterset_fields = ["patient__patient_id","code"]

class MedicationOrderViewSet(viewsets.ModelViewSet):
    queryset = MedicationOrder.objects.select_related("patient").all()
    serializer_class = MedicationOrderSerializer

class LabResultViewSet(viewsets.ModelViewSet):
    queryset = LabResult.objects.select_related("patient").all()
    serializer_class = LabResultSerializer
