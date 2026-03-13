@echo off
echo ============================================
echo  ComfyNode Designer - Production Build
echo ============================================
echo.
echo What this does:
echo   - Compiles TypeScript + React (Vite)
echo   - Bundles Electron main process
echo   - Outputs to: out\  (NOT an installer)
echo.
echo To create an installer, run: package-win.bat
echo ============================================
echo.

npm run build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo  Build SUCCESS
    echo  Output: out\main\   out\preload\   out\renderer\
    echo  Next:   Run package-win.bat to create installer
    echo ============================================
) else (
    echo.
    echo ============================================
    echo  Build FAILED - check errors above
    echo ============================================
)
echo.
pause
