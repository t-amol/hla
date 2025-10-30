from prefect import flow, task
from pipelines.etl.load_seed import load_all
from pipelines.etl.to_duckdb import build_marts
from pipelines.etl.to_opensearch import index_search

@task
def t_load():
    load_all()

@task
def t_duckdb():
    build_marts()

@task
def t_search():
    index_search()

@flow
def nightly_build():
    t_load()
    t_duckdb()
    t_search()

if __name__ == "__main__":
    nightly_build()
