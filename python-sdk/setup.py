"""
Setup configuration for Claude Code Python SDK
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="claude-code-sdk",
    version="0.1.0",
    author="Claude Code SDK Team",
    author_email="sdk@example.com",
    description="Official Python SDK for Claude Code CLI with dual-agent support",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/claude-code-python-sdk",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    python_requires=">=3.10",
    install_requires=[
        'aiohttp>=3.8.0',  # Required for WebSocket and HTTP communication
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "black>=22.0.0",
            "isort>=5.0.0",
            "mypy>=1.0.0",
            "flake8>=4.0.0",
        ],
        "test": [
            "pytest>=7.0.0",
            "pytest-mock>=3.0.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "claude-code-sdk=claude_code_sdk.cli:main",
        ],
    },
)