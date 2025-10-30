from opensearchpy import OpenSearch
import csv

client = OpenSearch(hosts=[{"host":"opensearch","port":9200,"scheme":"http"}])

def index_search():
    client.indices.create(index="patients", ignore=400)
    with open("metadata/seed/patients.csv") as f:
        for row in csv.DictReader(f):
            client.index(index="patients", id=row["patient_id"], document=row)
    print("Indexed patients into OpenSearch.")

if __name__ == "__main__":
    index_search()
