# Debug Log

This file tracks bugs and operational failures encountered during development,
including confirmed root causes and verified fixes.

## 1) Slavic model image build fails with 404

- Symptom:
	- `docker compose --profile sr up -d --build` (or `--profile sh`) fails during model download.
	- Build step returns HTTP 404 for model ZIP URL.
- Root cause:
	- Upstream model archive links for `vosk-model-small-sr-0.4` and
		`vosk-model-small-sh-0.4` were unavailable/moved.
- Fix:
	- Profile-gated optional services in [docker-compose.yml](docker-compose.yml) so default stack stays usable.
	- Added environment overrides in [.env.example](.env.example) for `VOSK_MODEL_URL_SR`,
		`VOSK_MODEL_DIR_SR`, `VOSK_MODEL_URL_SH`, `VOSK_MODEL_DIR_SH`.
	- Updated [README.md](README.md) with profile usage and override instructions.
- Verification:
	- `make docker-up` starts English-only stack successfully.
	- `make docker-up-sr`/`make docker-up-sh` fail only at expected upstream 404, confirming wiring is correct.

## 2) Backend startup fails: Address already in use

- Symptom:
	- `make backend-dev` fails when port `8000` is occupied.
- Root cause:
	- Fixed-port startup (`8000`) with no fallback.
- Fix:
	- Updated [Makefile](Makefile) `backend-dev` target to auto-select first free port (`8000`, `8001`, ...).
	- Prints a clear message when fallback port is used.
- Verification:
	- With `8000` busy, `make backend-dev` starts successfully on next free port.

## 3) Docker Desktop daemon unreachable / 500 errors

- Symptom:
	- Docker commands fail with daemon/engine errors (including
		`dockerDesktopLinuxEngine` pipe failures and HTTP 500-like behavior).
	- Docker Desktop appears stuck loading.
- Root cause:
	- Docker Desktop + WSL backend got into a bad runtime state.
- Fix:
	- Recovery sequence:
		1. Kill Docker Desktop processes.
		2. Run `wsl --shutdown`.
		3. Restart Docker Desktop service/app.
		4. Re-open shell and retry Docker commands.
- Verification:
	- `docker version` returns both Client and Server.
	- Compose commands run again (`make docker-down`, `make docker-ps`).

## 4) Usability issue: `make docker down` did not work

- Symptom:
	- Running `make docker down` fails due to target parsing as two words.
- Root cause:
	- Makefile only defined dashed targets (`docker-down`, `docker-ps`, `docker-logs`).
- Fix:
	- Added alias targets in [Makefile](Makefile):
		- `docker up` -> `docker-up`
		- `docker down` -> `docker-down`
		- `docker ps` -> `docker-ps`
		- `docker logs` -> `docker-logs`
- Verification:
	- Both styles now work:
		- `make docker-down` and `make docker down`
		- `make docker-ps` and `make docker ps`

## 5) Model availability feedback unclear in UI

- Symptom:
	- Users could select a model that was not ready, then see backend errors later.
- Root cause:
	- Frontend had no per-model readiness hint tied to `/health` model map.
- Fix:
	- Added model readiness parsing and hint display in [src/public/stt.js](src/public/stt.js).
	- Added model selector + hint UI in [src/views/index.ejs](src/views/index.ejs).
	- Backend `/health` now reports `vosk_models` readiness map in [backend/app.py](backend/app.py).
- Verification:
	- With only English service running:
		- `en` reports ready.
		- `sr`/`sh` report not ready and UI indicates availability correctly.

