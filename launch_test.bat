@echo off
echo ============================================
echo  ComfyNode Designer - Run Tests
echo ============================================
echo.
echo Running vitest (unit tests for code generator)
echo Test file: src\main\generators\codeGenerator.test.ts
echo ============================================
echo.

npm test

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo  All tests PASSED
    echo ============================================
) else (
    echo.
    echo ============================================
    echo  Tests FAILED - check errors above
    echo ============================================
)
echo.
pause
