from django.db import models

class Patient(models.Model):
    patient_id = models.CharField(max_length=50, primary_key=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    gender = models.CharField(max_length=10)
    birth_date = models.DateField()
    address = models.CharField(max_length=200, blank=True)

class Provider(models.Model):
    provider_id = models.CharField(max_length=50, primary_key=True)
    name = models.CharField(max_length=120)
    specialty = models.CharField(max_length=120)

class Encounter(models.Model):
    encounter_id = models.CharField(max_length=50, primary_key=True)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    provider = models.ForeignKey(Provider, null=True, blank=True, on_delete=models.SET_NULL)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    encounter_type = models.CharField(max_length=20)

class Observation(models.Model):
    observation_id = models.CharField(max_length=50, primary_key=True)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    encounter = models.ForeignKey(Encounter, null=True, blank=True, on_delete=models.SET_NULL)
    code = models.CharField(max_length=50)
    value = models.FloatField()
    unit = models.CharField(max_length=20)
    effective_time = models.DateTimeField()

class MedicationOrder(models.Model):
    order_id = models.CharField(max_length=50, primary_key=True)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    encounter = models.ForeignKey(Encounter, null=True, blank=True, on_delete=models.SET_NULL)
    medication_code = models.CharField(max_length=50)
    dose_mg = models.FloatField()
    frequency_per_day = models.IntegerField()
    start_date = models.DateField()
    end_date = models.DateField()

class LabResult(models.Model):
    lab_id = models.CharField(max_length=50, primary_key=True)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    encounter = models.ForeignKey(Encounter, null=True, blank=True, on_delete=models.SET_NULL)
    test_name = models.CharField(max_length=100)
    result_value = models.FloatField()
    reference_low = models.FloatField()
    reference_high = models.FloatField()
    collected_time = models.DateTimeField()
