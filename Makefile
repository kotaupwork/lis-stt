# ──────────────────────────────────────────────────────────────────────────────
# Makefile — TypeScript project
#
# Requires: make, Node.js 20+, npm
# On Windows: use make.bat as a thin wrapper, or install Make via:
#   winget install GnuWin32.Make
#   choco install make
# ──────────────────────────────────────────────────────────────────────────────

.PHONY: help scaffold install dev build start test lint format clean backend-install backend-dev backend-test docker-up docker-down docker-logs docker-ps

# Default target
help:
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "  scaffold  Create template folder structure"
	@echo "  install   Install npm dependencies"
	@echo "  dev       Run in development mode (hot reload)"
	@echo "  build     Type-check TypeScript"
	@echo "  start     Run app in non-watch mode"
	@echo "  test      Run tests"
	@echo "  lint      Lint with ESLint"
	@echo "  format    Format with Prettier"
	@echo "  backend-install Install Python backend dependencies"
	@echo "  backend-dev Run Python STT backend (FastAPI)"
	@echo "  backend-test Run Python backend tests (Phase 4)"
	@echo "  docker-up Start Vosk + backend services with Docker Compose"
	@echo "  docker-down Stop Docker Compose services"
	@echo "  docker-logs Tail Docker Compose logs"
	@echo "  docker-ps List running Docker Compose services"
	@echo "  clean     Remove logs/ contents"
	@echo ""

scaffold:
	@echo "Creating htmx template folder structure..."
	@mkdir -p docs logs src/public src/views src/views/partials tests
	@touch logs/.gitkeep
	@touch tests/.gitkeep
	@echo "Done."

install:
	npm install

dev:
	npm run dev

build:
	npm run build

start:
	npm run start

test:
	npm test

lint:
	npm run lint

format:
	npm run format

backend-install:
	pip install -r backend/requirements.txt

backend-dev:
	uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload

backend-test:
	python -m pytest backend/tests -q

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f --tail=200

docker-ps:
	docker compose ps

clean:
	@echo "Cleaning logs/..."
	@find logs/ -type f ! -name '.gitkeep' -delete 2>/dev/null || true
	@echo "Done."
