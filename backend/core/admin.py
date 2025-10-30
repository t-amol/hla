from django.contrib import admin
from .domain.models import Patient, Provider, Encounter, Observation, MedicationOrder, LabResult
admin.site.register(Patient)
admin.site.register(Provider)
admin.site.register(Encounter)
admin.site.register(Observation)
admin.site.register(MedicationOrder)
admin.site.register(LabResult)
