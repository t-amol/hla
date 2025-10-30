up:
	docker compose up -d --build

down:
	docker compose down

clean:
	docker compose down -v || true
	rm -rf duckdb || true
	rm -rf pipelines/.prefect || true

seed:
	docker compose exec -T backend bash -lc "python -m pipelines.etl.load_seed"

marts:
	docker compose exec -T backend bash -lc "python -m pipelines.etl.to_duckdb"
