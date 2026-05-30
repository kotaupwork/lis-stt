# ──────────────────────────────────────────────────────────────────────────────
# Makefile — TypeScript project
#
# Requires: make, Node.js 20+, npm
# On Windows: use make.bat as a thin wrapper, or install Make via:
#   winget install GnuWin32.Make
#   choco install make
# ──────────────────────────────────────────────────────────────────────────────

.PHONY: help scaffold install dev build start test lint format clean backend-install backend-install-dev backend-dev backend-test audio-samples-install audio-samples workflow workflo2 docker-up docker-up-sr docker-up-sh docker-up-slavic docker-down docker-logs docker-ps free-port-3000 free-port-8000 docker up down ps logs

# Prefer python3 on Linux/WSL, fall back to python.
PYTHON := $(shell command -v python3 2>/dev/null || command -v python 2>/dev/null)
BACKEND_PORT ?= 8000

# Default target
help:
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "  scaffold               Create template folder structure"
	@echo "  install                Install npm dependencies"
	@echo "  dev                    Free :3000 if needed, then run in development mode (hot reload)"
	@echo "  build                  Type-check TypeScript"
	@echo "  start                  Run app in non-watch mode"
	@echo "  test                   Run tests"
	@echo "  lint                   Lint with ESLint"
	@echo "  format                 Format with Prettier"
	@echo "  backend-install        Install Python backend dependencies"
	@echo "  backend-install-dev    Install Python backend dev/test dependencies"
	@echo "  backend-dev            Run Python STT backend (FastAPI), auto-fallback to next free port if busy"
	@echo "  backend-test           Run Python backend tests (Phase 4)"
	@echo "  audio-samples-install  Install TTS dependency for sample generation"
	@echo "  audio-samples          Generate 4 mp3 STT test files (SR/EN, male/female)"
	@echo "  workflow               Run full project workflow (setup, tests, samples, docker)"
	@echo "  docker-up              Start Vosk + backend services with Docker Compose (docker/docker.exe)"
	@echo "  docker-up-sr           Start Docker Compose with Serbian profile (vosk-sr + backend)"
	@echo "  docker-up-sh           Start Docker Compose with Serbo-Croatian profile (vosk-sh + backend)"
	@echo "  docker-up-slavic       Start Docker Compose with Serbian and Serbo-Croatian profiles"
	@echo "  docker up              Alias for docker-up"
	@echo "  docker-down            Stop Docker Compose services"
	@echo "  docker down            Alias for docker-down"
	@echo "  docker-logs            Tail Docker Compose logs"
	@echo "  docker logs            Alias for docker-logs"
	@echo "  docker-ps              List running Docker Compose services"
	@echo "  docker ps              Alias for docker-ps"
	@echo "  clean                  Remove logs/ contents"
	@echo ""

docker:
	@true

up: docker-up

down: docker-down

ps: docker-ps

logs: docker-logs

scaffold:
	@echo "Creating htmx template folder structure..."
	@mkdir -p docs logs src/public src/views src/views/partials tests
	@touch logs/.gitkeep
	@touch tests/.gitkeep
	@echo "Done."

install:
	npm install

dev: free-port-3000
	npm run dev

free-port-3000:
	@powershell -NoProfile -ExecutionPolicy Bypass -Command "$$pids = (netstat -ano | findstr :3000 | ForEach-Object { ($$_ -split '\\s+')[-1] } | Sort-Object -Unique); foreach ($$pid in $$pids) { if ($$pid -match '^[0-9]+$$') { try { taskkill /PID $$pid /F | Out-Null } catch {} } }" > /dev/null 2>&1 || true

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
	$(PYTHON) -m pip install -r backend/requirements.txt

backend-install-dev:
	$(PYTHON) -m pip install -r backend/requirements-dev.txt

backend-dev:
	@PORT=$(BACKEND_PORT); \
	while ss -ltn "( sport = :$$PORT )" 2>/dev/null | tail -n +2 | grep -q .; do PORT=$$((PORT + 1)); done; \
	if [ "$$PORT" != "$(BACKEND_PORT)" ]; then \
		echo "Port $(BACKEND_PORT) is busy. Starting backend on $$PORT instead."; \
		echo "If needed, set STT_BACKEND_URL=http://localhost:$$PORT for the frontend."; \
	fi; \
	uvicorn backend.app:app --host 0.0.0.0 --port $$PORT --reload

free-port-8000:
	@pkill -f "uvicorn backend.app:app" > /dev/null 2>&1 || true
	@pkill -f "uvicorn.*$(BACKEND_PORT)" > /dev/null 2>&1 || true
	@fuser -k $(BACKEND_PORT)/tcp > /dev/null 2>&1 || true
	@{ pids=$$(lsof -ti tcp:$(BACKEND_PORT) 2>/dev/null || true); if [ -n "$$pids" ]; then kill -9 $$pids 2>/dev/null || true; fi; } > /dev/null 2>&1 || true
	@if [ -z "$$WSL_DISTRO_NAME" ]; then powershell -NoProfile -ExecutionPolicy Bypass -Command "$$pids = Get-NetTCPConnection -LocalPort $(BACKEND_PORT) -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($$pid in $$pids) { if ($$pid -match '^[0-9]+$$') { try { taskkill /PID $$pid /F | Out-Null } catch {} } }" > /dev/null 2>&1 || true; fi

backend-test: backend-install-dev
	$(PYTHON) -m pytest backend/tests -q

audio-samples-install:
	$(PYTHON) -m pip install edge-tts

audio-samples:
	$(PYTHON) tools/generate_test_audio.py

workflow:
	@echo "Running full workflow..."
	$(MAKE) scaffold
	$(MAKE) install
	$(MAKE) backend-install
	$(MAKE) audio-samples-install
	$(MAKE) audio-samples
	$(MAKE) build
	$(MAKE) backend-test
	@if docker version >/dev/null 2>&1 || docker.exe version >/dev/null 2>&1 || [ -x "/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" ]; then \
		$(MAKE) docker-up; \
	else \
		echo "Docker not found in current environment. Skipping docker-up."; \
		echo "If using WSL, enable Docker Desktop WSL integration or run docker-up from Windows."; \
	fi
	@echo "Workflow complete. Start web app with: make dev"

workflo2: workflow

docker-up:
	@set -e; \
	if docker version >/dev/null 2>&1; then DCMD="docker"; \
	elif docker.exe version >/dev/null 2>&1; then DCMD="docker.exe"; \
	elif [ -x "/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" ]; then DCMD="/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe"; \
	else \
		echo "Docker CLI not available in this environment."; \
		echo "WSL fix: Docker Desktop > Settings > Resources > WSL Integration > enable this distro."; \
		echo "Then restart shell and rerun: make docker-up"; \
		exit 1; \
	fi; \
	echo "Using $$DCMD"; \
	if ! "$$DCMD" info >/dev/null 2>&1; then \
		echo "Docker daemon is not reachable."; \
		echo "Start Docker Desktop and ensure WSL integration is enabled for this distro."; \
		exit 1; \
	fi; \
	"$$DCMD" compose pull; \
	"$$DCMD" compose up -d

docker-up-sr:
	@set -e; \
	if docker version >/dev/null 2>&1; then DCMD="docker"; \
	elif docker.exe version >/dev/null 2>&1; then DCMD="docker.exe"; \
	elif [ -x "/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" ]; then DCMD="/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe"; \
	else \
		echo "Docker CLI not available in this environment."; \
		echo "WSL fix: Docker Desktop > Settings > Resources > WSL Integration > enable this distro."; \
		echo "Then restart shell and rerun: make docker-up-sr"; \
		exit 1; \
	fi; \
	echo "Using $$DCMD"; \
	if ! "$$DCMD" info >/dev/null 2>&1; then \
		echo "Docker daemon is not reachable."; \
		echo "Start Docker Desktop and ensure WSL integration is enabled for this distro."; \
		exit 1; \
	fi; \
	"$$DCMD" compose --profile sr pull; \
	"$$DCMD" compose --profile sr up -d

docker-up-sh:
	@set -e; \
	if docker version >/dev/null 2>&1; then DCMD="docker"; \
	elif docker.exe version >/dev/null 2>&1; then DCMD="docker.exe"; \
	elif [ -x "/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" ]; then DCMD="/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe"; \
	else \
		echo "Docker CLI not available in this environment."; \
		echo "WSL fix: Docker Desktop > Settings > Resources > WSL Integration > enable this distro."; \
		echo "Then restart shell and rerun: make docker-up-sh"; \
		exit 1; \
	fi; \
	echo "Using $$DCMD"; \
	if ! "$$DCMD" info >/dev/null 2>&1; then \
		echo "Docker daemon is not reachable."; \
		echo "Start Docker Desktop and ensure WSL integration is enabled for this distro."; \
		exit 1; \
	fi; \
	"$$DCMD" compose --profile sh pull; \
	"$$DCMD" compose --profile sh up -d

docker-up-slavic:
	@set -e; \
	if docker version >/dev/null 2>&1; then DCMD="docker"; \
	elif docker.exe version >/dev/null 2>&1; then DCMD="docker.exe"; \
	elif [ -x "/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" ]; then DCMD="/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe"; \
	else \
		echo "Docker CLI not available in this environment."; \
		echo "WSL fix: Docker Desktop > Settings > Resources > WSL Integration > enable this distro."; \
		echo "Then restart shell and rerun: make docker-up-slavic"; \
		exit 1; \
	fi; \
	echo "Using $$DCMD"; \
	if ! "$$DCMD" info >/dev/null 2>&1; then \
		echo "Docker daemon is not reachable."; \
		echo "Start Docker Desktop and ensure WSL integration is enabled for this distro."; \
		exit 1; \
	fi; \
	"$$DCMD" compose --profile sr --profile sh pull; \
	"$$DCMD" compose --profile sr --profile sh up -d

docker-down:
	@set -e; \
	if docker version >/dev/null 2>&1; then DCMD="docker"; \
	elif docker.exe version >/dev/null 2>&1; then DCMD="docker.exe"; \
	elif [ -x "/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" ]; then DCMD="/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe"; \
	else \
		echo "Docker CLI not available in this environment."; \
		exit 1; \
	fi; \
	if ! "$$DCMD" info >/dev/null 2>&1; then \
		echo "Docker daemon is not reachable."; \
		echo "Start Docker Desktop and ensure WSL integration is enabled for this distro."; \
		exit 1; \
	fi; \
	"$$DCMD" compose down

docker-logs:
	@set -e; \
	if docker version >/dev/null 2>&1; then DCMD="docker"; \
	elif docker.exe version >/dev/null 2>&1; then DCMD="docker.exe"; \
	elif [ -x "/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" ]; then DCMD="/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe"; \
	else \
		echo "Docker CLI not available in this environment."; \
		exit 1; \
	fi; \
	if ! "$$DCMD" info >/dev/null 2>&1; then \
		echo "Docker daemon is not reachable."; \
		echo "Start Docker Desktop and ensure WSL integration is enabled for this distro."; \
		exit 1; \
	fi; \
	"$$DCMD" compose logs -f --tail=200

docker-ps:
	@set -e; \
	if docker version >/dev/null 2>&1; then DCMD="docker"; \
	elif docker.exe version >/dev/null 2>&1; then DCMD="docker.exe"; \
	elif [ -x "/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" ]; then DCMD="/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe"; \
	else \
		echo "Docker CLI not available in this environment."; \
		exit 1; \
	fi; \
	if ! "$$DCMD" info >/dev/null 2>&1; then \
		echo "Docker daemon is not reachable."; \
		echo "Start Docker Desktop and ensure WSL integration is enabled for this distro."; \
		exit 1; \
	fi; \
	"$$DCMD" compose ps

clean:
	@echo "Cleaning logs/..."
	@find logs/ -type f ! -name '.gitkeep' -delete 2>/dev/null || true
	@echo "Done."
