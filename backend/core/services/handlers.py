from dataclasses import dataclass
from .commands import CreatePatient
from core.infra.repositories import PatientRepository, unit_of_work

@dataclass
class CommandBus:
    patient_repo: PatientRepository

    def handle(self, cmd: CreatePatient):
        with unit_of_work():
            return self.patient_repo.add(**cmd.payload)
