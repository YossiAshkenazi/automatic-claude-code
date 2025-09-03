# Minimal makefile for Sphinx documentation

# You can set these variables from the command line, and also
# from the environment for the first two.
SPHINXOPTS    ?=
SPHINXBUILD  ?= sphinx-build
SOURCEDIR    = .
BUILDDIR     = _build

# Put it first so that "make" without argument is like "make help".
help:
	@$(SPHINXBUILD) -M help "$(SOURCEDIR)" "$(BUILDDIR)" $(SPHINXOPTS) $(O)

.PHONY: help Makefile

# Development targets
install:
	@echo "Installing documentation dependencies..."
	@pip install -e "..[docs]" 2>/dev/null || pip install sphinx sphinx-rtd-theme myst-parser sphinx-autodoc-typehints

clean:
	@echo "Cleaning build directory..."
	@rm -rf $(BUILDDIR)/*

apidoc:
	@echo "Generating API documentation..."
	@sphinx-apidoc -o api ../claude_code_sdk --force --module-first --separate

serve: html
	@echo "Starting local documentation server..."
	@echo "Documentation will be available at: http://localhost:8000"
	@cd $(BUILDDIR)/html && python -m http.server 8000

livehtml:
	@echo "Starting live-reload documentation server..."
	@pip install sphinx-autobuild 2>/dev/null || echo "Install sphinx-autobuild for live reload: pip install sphinx-autobuild"
	@sphinx-autobuild "$(SOURCEDIR)" "$(BUILDDIR)/html" $(SPHINXOPTS) $(O) --host 0.0.0.0 --port 8000

check:
	@echo "Checking documentation for issues..."
	@$(SPHINXBUILD) -b html "$(SOURCEDIR)" "$(BUILDDIR)/html" -W --keep-going $(SPHINXOPTS) $(O)
	@echo "Checking for missing references..."
	@$(SPHINXBUILD) -b linkcheck "$(SOURCEDIR)" "$(BUILDDIR)/linkcheck" $(SPHINXOPTS) $(O)

spelling:
	@echo "Checking spelling..."
	@pip install sphinxcontrib-spelling 2>/dev/null || echo "Install sphinxcontrib-spelling for spell check: pip install sphinxcontrib-spelling"
	@$(SPHINXBUILD) -b spelling "$(SOURCEDIR)" "$(BUILDDIR)/spelling" $(SPHINXOPTS) $(O)

pdf:
	@echo "Building PDF documentation..."
	@$(SPHINXBUILD) -b latex "$(SOURCEDIR)" "$(BUILDDIR)/latex" $(SPHINXOPTS) $(O)
	@cd $(BUILDDIR)/latex && make all-pdf

epub:
	@echo "Building EPUB documentation..."
	@$(SPHINXBUILD) -b epub "$(SOURCEDIR)" "$(BUILDDIR)/epub" $(SPHINXOPTS) $(O)

coverage:
	@echo "Checking documentation coverage..."
	@$(SPHINXBUILD) -b coverage "$(SOURCEDIR)" "$(BUILDDIR)/coverage" $(SPHINXOPTS) $(O)
	@cat $(BUILDDIR)/coverage/python.txt

# GitHub Pages deployment simulation
gh-pages: clean apidoc
	@echo "Building documentation for GitHub Pages..."
	@GITHUB_ACTIONS=true $(SPHINXBUILD) -b html "$(SOURCEDIR)" "$(BUILDDIR)/html" -v $(SPHINXOPTS) $(O)
	@touch $(BUILDDIR)/html/.nojekyll
	@echo "Documentation built for GitHub Pages deployment"

# Development workflow
dev: clean install apidoc livehtml

# Production build
build: clean install apidoc gh-pages

# Quick development check
quick: apidoc html

# Catch-all target: route all unknown targets to Sphinx using the new
# "make mode" option.  $(O) is meant as a shortcut for $(SPHINXOPTS).
%: Makefile
	@$(SPHINXBUILD) -M $@ "$(SOURCEDIR)" "$(BUILDDIR)" $(SPHINXOPTS) $(O)