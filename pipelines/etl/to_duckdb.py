import duckdb, pandas as pd, os
DB = "/app/duckdb/health.duckdb"
os.makedirs("/app/duckdb", exist_ok=True)

def build_marts():
    con = duckdb.connect(DB)
    patients = pd.read_csv("metadata/seed/patients.csv")
    obs = pd.read_csv("metadata/seed/observations.csv")
    con.register("patients", patients)
    con.register("observations", obs)
    con.execute("CREATE OR REPLACE TABLE patients AS SELECT * FROM patients")
    con.execute("""        CREATE OR REPLACE VIEW bp_by_patient AS
        SELECT patient AS patient_id, AVG(value) AS avg_sys_bp
        FROM observations WHERE code='BP_SYS' GROUP BY patient
    """)
    con.close()
    print("DuckDB marts built.")

if __name__ == "__main__":
    build_marts()
