@echo off
echo ============================================
echo  ComfyNode Designer - Package for Windows
echo ============================================
echo.
echo What this does:
echo   1. Runs production build (out\)
echo   2. Runs electron-builder to create:
echo      - dist\win-unpacked\  (run directly, no install)
echo      - dist\ComfyNode Designer Setup x.y.z.exe  (NSIS installer)
echo.
echo The installer will ask where to install.
echo ============================================
echo.

npm run package

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo  Package SUCCESS
    echo  Installer:  dist\
    echo  Unpacked:   dist\win-unpacked\
    echo  Run now:    run.bat
    echo ============================================
) else (
    echo.
    echo ============================================
    echo  Package FAILED - check errors above
    echo ============================================
)
echo.
pause
