@echo off
:: make.bat — Windows wrapper for Makefile targets
:: Usage: make.bat <target>
:: Falls back to direct npm commands if GNU Make is not installed.

setlocal

:: Check if GNU Make executable is available
where make.exe >nul 2>&1
if %errorlevel% == 0 (
    make.exe %*
    exit /b %errorlevel%
)

:: ── Fallback: direct npm commands (no Make required) ─────────────────────

set TARGET=%1

if "%TARGET%"=="" goto :help
if "%TARGET%"=="help" goto :help
if "%TARGET%"=="scaffold" goto :scaffold
if "%TARGET%"=="install" goto :install
if "%TARGET%"=="dev" goto :dev
if "%TARGET%"=="build" goto :build
if "%TARGET%"=="start" goto :start
if "%TARGET%"=="test" goto :test
if "%TARGET%"=="lint" goto :lint
if "%TARGET%"=="format" goto :format
if "%TARGET%"=="backend-install" goto :backend_install
if "%TARGET%"=="backend-install-dev" goto :backend_install_dev
if "%TARGET%"=="backend-dev" goto :backend_dev
if "%TARGET%"=="backend-test" goto :backend_test
if "%TARGET%"=="audio-samples-install" goto :audio_samples_install
if "%TARGET%"=="audio-samples" goto :audio_samples
if "%TARGET%"=="workflow" goto :workflow
if "%TARGET%"=="docker-up" goto :docker_up
if "%TARGET%"=="docker-down" goto :docker_down
if "%TARGET%"=="docker-logs" goto :docker_logs
if "%TARGET%"=="docker-ps" goto :docker_ps
if "%TARGET%"=="clean" goto :clean

echo Unknown target: %TARGET%
goto :help

:help
echo.
echo Usage: make.bat ^<target^>
echo.
echo   scaffold  Create template folder structure
echo   install   Install npm dependencies
echo   dev       Free :3000 if needed, then run in development mode (hot reload)
echo   build     Type-check TypeScript
echo   start     Run app in non-watch mode
echo   test      Run tests
echo   lint      Lint with ESLint
echo   format    Format with Prettier
echo   backend-install Install Python backend dependencies
echo   backend-install-dev Install Python backend dev/test dependencies
echo   backend-dev Run Python STT backend (FastAPI)
echo   backend-test Run Python backend tests
echo   audio-samples-install Install TTS dependency for sample generation
echo   audio-samples Generate 4 mp3 STT test files
echo   workflow  Run full project workflow (setup, tests, samples, docker)
echo   docker-up Pull prebuilt images and start frontend + backend + Vosk services
echo   docker-down Stop Docker services
echo   docker-logs Tail Docker logs
echo   docker-ps List Docker services
echo   clean     Remove logs\ contents
echo.
goto :end

:scaffold
echo Creating htmx template folder structure...
if not exist docs\ mkdir docs
if not exist logs\ mkdir logs
if not exist src\ mkdir src
if not exist src\public\ mkdir src\public
if not exist src\views\ mkdir src\views
if not exist src\views\partials\ mkdir src\views\partials
if not exist tests\ mkdir tests
if not exist logs\.gitkeep type nul > logs\.gitkeep
if not exist tests\.gitkeep type nul > tests\.gitkeep
echo Done.
goto :end

:install
npm install
goto :end

:dev
for /f "tokens=5" %%P in ('netstat -ano ^| findstr :3000') do (
    if not "%%P"=="0" taskkill /PID %%P /F >nul 2>nul
)
npm run dev
goto :end

:build
npm run build
goto :end

:start
npm run start
goto :end

:test
npm test
goto :end

:lint
npm run lint
goto :end

:format
npm run format
goto :end

:backend_install
pip install -r backend\requirements.txt
goto :end

:backend_install_dev
pip install -r backend\requirements-dev.txt
goto :end

:backend_dev
uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
goto :end

:backend_test
call :backend_install_dev
if errorlevel 1 exit /b %errorlevel%
python -m pytest backend\tests -q
goto :end

:audio_samples_install
python -m pip install edge-tts
goto :end

:audio_samples
python tools\generate_test_audio.py
goto :end

:workflow
echo Running full workflow...
call :scaffold
if errorlevel 1 goto :fail
call :install
if errorlevel 1 goto :fail
call :backend_install
if errorlevel 1 goto :fail
call :audio_samples_install
if errorlevel 1 goto :fail
call :audio_samples
if errorlevel 1 goto :fail
call :build
if errorlevel 1 goto :fail
call :backend_test
if errorlevel 1 goto :fail
docker version >nul 2>&1
if %errorlevel%==0 (
    call :docker_up
    if errorlevel 1 goto :fail
) else (
    echo Docker not found in current environment. Skipping docker-up.
    echo If using WSL, enable Docker Desktop WSL integration or run docker-up from Windows.
)
echo Workflow complete. Start web app with: make.bat dev
goto :end

:docker_up
docker compose pull
if errorlevel 1 exit /b %errorlevel%
docker compose up -d
goto :end

:docker_down
docker compose down
goto :end

:docker_logs
docker compose logs -f --tail=200
goto :end

:docker_ps
docker compose ps
goto :end

:fail
echo Workflow failed.
exit /b 1

:clean
echo Cleaning logs\...
if exist logs\ (
    for /f "delims=" %%i in ('dir /b logs\') do (
        if not "%%i"==".gitkeep" del /q "logs\%%i" 2>nul
    )
)
echo Done.
goto :end

:end
endlocal
