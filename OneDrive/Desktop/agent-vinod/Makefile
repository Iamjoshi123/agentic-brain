.PHONY: dev backend frontend seed test lint docker-up docker-down install

install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

dev:
	$(MAKE) backend &
	$(MAKE) frontend &
	wait

backend:
	cd backend && uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

seed:
	cd backend && python -m app.seed

test:
	cd backend && python -m pytest tests/ -v
	cd frontend && npm test

lint:
	cd backend && python -m ruff check app/
	cd frontend && npm run lint

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

db-reset:
	cd backend && rm -f agentic_demo_brain.db && python -m app.seed
