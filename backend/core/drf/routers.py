from rest_framework.routers import DefaultRouter
from .viewsets import (
  PatientViewSet, ProviderViewSet, EncounterViewSet,
  ObservationViewSet, MedicationOrderViewSet, LabResultViewSet
)

router = DefaultRouter()
router.register(r"patients", PatientViewSet)
router.register(r"providers", ProviderViewSet)
router.register(r"encounters", EncounterViewSet)
router.register(r"observations", ObservationViewSet)
router.register(r"medications", MedicationOrderViewSet)
router.register(r"labs", LabResultViewSet)
