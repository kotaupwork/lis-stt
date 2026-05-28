# ──────────────────────────────────────────────────────────────────────────────
# Makefile — TypeScript project
#
# Requires: make, Node.js 20+, npm
# On Windows: use make.bat as a thin wrapper, or install Make via:
#   winget install GnuWin32.Make
#   choco install make
# ──────────────────────────────────────────────────────────────────────────────

.PHONY: help scaffold install dev build start test lint format clean

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

clean:
	@echo "Cleaning logs/..."
	@find logs/ -type f ! -name '.gitkeep' -delete 2>/dev/null || true
	@echo "Done."
