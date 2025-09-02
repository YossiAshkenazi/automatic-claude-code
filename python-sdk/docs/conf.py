# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

import os
import sys
from pathlib import Path

# Add the project root to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

project = 'Claude Code SDK'
copyright = '2024, Claude Code SDK Team'
author = 'Claude Code SDK Team'
release = '0.1.0'
version = '0.1.0'

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration

extensions = [
    'sphinx.ext.autodoc',
    'sphinx.ext.autosummary',
    'sphinx.ext.napoleon',
    'sphinx.ext.viewcode',
    'sphinx.ext.intersphinx',
    'sphinx_autodoc_typehints',
    'myst_parser',
]

templates_path = ['_templates']
exclude_patterns = ['_build', 'Thumbs.db', '.DS_Store']

# -- Options for HTML output ------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = 'sphinx_rtd_theme'
html_static_path = ['_static']
html_title = f'{project} v{version}'
html_short_title = 'Claude Code SDK'

# Theme options
html_theme_options = {
    'canonical_url': '',
    'analytics_id': '',
    'logo_only': False,
    'display_version': True,
    'prev_next_buttons_location': 'both',
    'style_external_links': False,
    'vcs_pageview_mode': '',
    'style_nav_header_background': '#2980b9',
    # Navigation depth
    'collapse_navigation': False,
    'sticky_navigation': True,
    'navigation_depth': 4,
    'includehidden': True,
    'titles_only': False
}

# Custom CSS
html_css_files = [
    'custom.css',
]

# Custom JavaScript for version selector
html_js_files = [
    'version-selector.js',
]

# Favicon
html_favicon = '_static/favicon.ico'

# -- Extension configuration -------------------------------------------------

# Autodoc configuration
autodoc_default_options = {
    'members': True,
    'member-order': 'bysource',
    'special-members': '__init__',
    'undoc-members': True,
    'exclude-members': '__weakref__'
}

# Napoleon settings
napoleon_google_docstring = True
napoleon_numpy_docstring = True
napoleon_include_init_with_doc = False
napoleon_include_private_with_doc = False
napoleon_include_special_with_doc = True
napoleon_use_admonition_for_examples = False
napoleon_use_admonition_for_notes = False
napoleon_use_admonition_for_references = False
napoleon_use_ivar = False
napoleon_use_param = True
napoleon_use_rtype = True
napoleon_preprocess_types = False
napoleon_type_aliases = None
napoleon_attr_annotations = True

# Intersphinx mapping
intersphinx_mapping = {
    'python': ('https://docs.python.org/3', None),
}

# MyST configuration
myst_enable_extensions = [
    "deflist",
    "tasklist",
    "colon_fence",
]

# Autosummary settings
autosummary_generate = True

# -- GitHub Pages configuration ---------------------------------------------

# Base URL for GitHub Pages
if os.environ.get('GITHUB_ACTIONS'):
    html_baseurl = 'https://yossiashkenazi.github.io/automatic-claude-code/python-sdk/'
else:
    html_baseurl = ''

# Version selector configuration
html_context = {
    'display_github': True,
    'github_user': 'YossiAshkenazi',
    'github_repo': 'automatic-claude-code',
    'github_version': 'main',
    'conf_py_path': '/python-sdk/docs/',
    'versions': [
        ('latest', 'latest'),
        ('v0.1.0', 'v0.1.0'),
    ]
}

# Source link configuration
html_show_sourcelink = True
html_sourcelink_suffix = ''

# Search configuration
html_search_language = 'en'
html_search_options = {'type': 'default'}
html_search_scorer = '_static/scorer.js'

# Output file configuration
html_file_suffix = '.html'
html_link_suffix = '.html'

# Custom 404 page
html_additional_pages = {
    '404': '404.html'
}