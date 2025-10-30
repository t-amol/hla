import csv, os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE","api.settings")
django.setup()

from core.domain.models import Patient, Provider, Encounter, Observation, MedicationOrder, LabResult

BASE = "metadata/seed"

def load_csv(model, path, fieldmap=None):
    fieldmap = fieldmap or (lambda r: r)
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            model.objects.update_or_create(**fieldmap(row))

def load_all():
    load_csv(Provider, f"{BASE}/providers.csv")
    load_csv(Patient, f"{BASE}/patients.csv")
    load_csv(Encounter, f"{BASE}/encounters.csv", lambda r: dict(
        encounter_id=r["encounter_id"],
        patient_id=r["patient"],
        provider_id=r["provider"],
        start_time=r["start_time"],
        end_time=r["end_time"],
        encounter_type=r["encounter_type"],
    ))
    load_csv(Observation, f"{BASE}/observations.csv", lambda r: dict(
        observation_id=r["observation_id"],
        patient_id=r["patient"],
        encounter_id=r["encounter"],
        code=r["code"],
        value=r["value"],
        unit=r["unit"],
        effective_time=r["effective_time"],
    ))
    load_csv(MedicationOrder, f"{BASE}/medications.csv", lambda r: dict(
        order_id=r["order_id"],
        patient_id=r["patient"],
        encounter_id=r["encounter"],
        medication_code=r["medication_code"],
        dose_mg=r["dose_mg"],
        frequency_per_day=r["frequency_per_day"],
        start_date=r["start_date"],
        end_date=r["end_date"],
    ))
    load_csv(LabResult, f"{BASE}/labs.csv", lambda r: dict(
        lab_id=r["lab_id"],
        patient_id=r["patient"],
        encounter_id=r["encounter"],
        test_name=r["test_name"],
        result_value=r["result_value"],
        reference_low=r["reference_low"],
        reference_high=r["reference_high"],
        collected_time=r["collected_time"],
    ))

if __name__ == "__main__":
    load_all()
    print("Seed loaded.")
