@echo off
set EXE=dist\win-unpacked\ComfyNode Designer.exe
if exist "%EXE%" (
    echo Launching ComfyNode Designer...
    start "" "%EXE%"
) else (
    echo ERROR: Packaged app not found at: %EXE%
    echo Run package-win.bat first to create the installer and unpacked build.
    pause
)
