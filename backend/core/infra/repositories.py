from contextlib import contextmanager
from django.db import transaction
from core.domain.models import Patient, Encounter

class PatientRepository:
    def get(self, patient_id: str) -> Patient:
        return Patient.objects.get(patient_id=patient_id)
    def add(self, **kwargs) -> Patient:
        return Patient.objects.create(**kwargs)

class EncounterRepository:
    def for_patient(self, patient_id: str):
        return Encounter.objects.filter(patient_id=patient_id)

@contextmanager
def unit_of_work():
    with transaction.atomic():
        yield
