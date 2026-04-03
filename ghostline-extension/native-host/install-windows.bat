@echo off
REM Install Ghostline Native Messaging Host for Windows

echo Installing Ghostline Native Messaging Host...
echo.

REM Get the current directory
set SCRIPT_DIR=%~dp0
set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%

REM Create manifest file
set MANIFEST_FILE=%SCRIPT_DIR%\com.ghostline.bridge.json

echo Creating manifest file...
(
echo {
echo   "name": "com.ghostline.bridge",
echo   "description": "Ghostline CoDrone Bridge",
echo   "path": "%SCRIPT_DIR%\\ghostline_bridge.exe",
echo   "type": "stdio",
echo   "allowed_origins": [
echo     "chrome-extension://EXTENSION_ID_HERE/"
echo   ]
echo }
) > "%MANIFEST_FILE%"

echo.
echo Registering with Chrome...

REM Register with Chrome
reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.ghostline.bridge" /ve /t REG_SZ /d "%MANIFEST_FILE%" /f

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✓ Installation successful!
    echo.
    echo IMPORTANT: You need to update the manifest file with your extension ID:
    echo 1. Load the extension in Chrome
    echo 2. Copy the extension ID from chrome://extensions
    echo 3. Edit: %MANIFEST_FILE%
    echo 4. Replace EXTENSION_ID_HERE with your actual extension ID
    echo.
) else (
    echo.
    echo ✗ Installation failed!
    echo.
)

pause
