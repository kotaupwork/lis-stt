@echo off
:: make.bat — Windows wrapper for Makefile targets
:: Usage: make.bat <target>
:: Falls back to direct npm commands if GNU Make is not installed.

setlocal

:: Check if GNU Make is available
where make >nul 2>&1
if %errorlevel% == 0 (
    make %*
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
if "%TARGET%"=="clean" goto :clean

echo Unknown target: %TARGET%
goto :help

:help
echo.
echo Usage: make.bat ^<target^>
echo.
echo   scaffold  Create template folder structure
echo   install   Install npm dependencies
echo   dev       Run in development mode (hot reload)
echo   build     Type-check TypeScript
echo   start     Run app in non-watch mode
echo   test      Run tests
echo   lint      Lint with ESLint
echo   format    Format with Prettier
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
