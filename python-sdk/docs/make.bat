@ECHO OFF

REM Command file for Sphinx documentation

if "%SPHINXBUILD%" == "" (
	set SPHINXBUILD=sphinx-build
)
set SOURCEDIR=.
set BUILDDIR=_build

%SPHINXBUILD% >NUL 2>NUL
if errorlevel 9009 (
	echo.
	echo.The 'sphinx-build' command was not found. Make sure you have Sphinx
	echo.installed, then set the SPHINXBUILD environment variable to point
	echo.to the full path of the 'sphinx-build' executable. Alternatively you
	echo.may add the Sphinx directory to PATH.
	echo.
	echo.If you don't have Sphinx installed, grab it from
	echo.https://sphinx-doc.org/
	exit /b 1
)

if "%1" == "" goto help
if "%1" == "help" goto help
if "%1" == "install" goto install
if "%1" == "clean" goto clean
if "%1" == "apidoc" goto apidoc
if "%1" == "serve" goto serve
if "%1" == "check" goto check
if "%1" == "gh-pages" goto gh-pages
if "%1" == "dev" goto dev
if "%1" == "build" goto build
if "%1" == "quick" goto quick

%SPHINXBUILD% -M %1 %SOURCEDIR% %BUILDDIR% %SPHINXOPTS% %O%
goto end

:help
%SPHINXBUILD% -M help %SOURCEDIR% %BUILDDIR% %SPHINXOPTS% %O%
echo.
echo.Additional commands:
echo.  install    Install documentation dependencies
echo.  clean      Clean build directory
echo.  apidoc     Generate API documentation
echo.  serve      Build HTML and serve locally
echo.  check      Check documentation for issues
echo.  gh-pages   Build for GitHub Pages deployment
echo.  dev        Development workflow (clean + install + apidoc + serve)
echo.  build      Production build
echo.  quick      Quick development check
goto end

:install
echo Installing documentation dependencies...
pip install -e "..[docs]" 2>NUL || pip install sphinx sphinx-rtd-theme myst-parser sphinx-autodoc-typehints
goto end

:clean
echo Cleaning build directory...
if exist "%BUILDDIR%" rmdir /S /Q "%BUILDDIR%"
goto end

:apidoc
echo Generating API documentation...
sphinx-apidoc -o api ../claude_code_sdk --force --module-first --separate
goto end

:serve
call :html
echo Starting local documentation server...
echo Documentation will be available at: http://localhost:8000
cd %BUILDDIR%\html && python -m http.server 8000
goto end

:check
echo Checking documentation for issues...
%SPHINXBUILD% -b html %SOURCEDIR% %BUILDDIR%\html -W --keep-going %SPHINXOPTS% %O%
echo Checking for missing references...
%SPHINXBUILD% -b linkcheck %SOURCEDIR% %BUILDDIR%\linkcheck %SPHINXOPTS% %O%
goto end

:gh-pages
call :clean
call :apidoc
echo Building documentation for GitHub Pages...
set GITHUB_ACTIONS=true
%SPHINXBUILD% -b html %SOURCEDIR% %BUILDDIR%\html -v %SPHINXOPTS% %O%
echo. > %BUILDDIR%\html\.nojekyll
echo Documentation built for GitHub Pages deployment
goto end

:dev
call :clean
call :install
call :apidoc
echo Starting development server...
echo Use Ctrl+C to stop
call :serve
goto end

:build
call :clean
call :install
call :gh-pages
goto end

:quick
call :apidoc
call :html
goto end

:html
%SPHINXBUILD% -b html %SOURCEDIR% %BUILDDIR%\html %SPHINXOPTS% %O%
goto end

:end