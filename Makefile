.PHONY: setup setup-backend setup-frontend backend frontend dev test clean

# Full setup
setup: setup-backend setup-frontend dirs
	@echo "Setup complete! Copy .env.example to .env and add your API keys."
	@echo "Then run: make dev"

# Backend setup
setup-backend:
	cd backend && pip install -e ".[dev]"

# Frontend setup
setup-frontend:
	cd frontend && npm install

# Create data directories
dirs:
	mkdir -p data/audio

# Run backend API server
backend:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run frontend dev server
frontend:
	cd frontend && npm run dev

# Run all services (open 3 terminals or use this with a process manager)
dev:
	@echo "Start these in separate terminals:"
	@echo "  make backend   - API server on :8000"
	@echo "  make frontend  - React dev server on :5173"

# Run tests
test:
	cd backend && pytest -v

# Clean runtime data
clean:
	rm -rf data/
	mkdir -p data/audio
