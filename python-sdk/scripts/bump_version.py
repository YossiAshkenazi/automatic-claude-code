#!/usr/bin/env python3
"""
Version Bumping Script for Claude Code Python SDK

Handles semantic versioning across all files and creates git tags.

Usage:
    python scripts/bump_version.py patch    # 0.1.0 -> 0.1.1
    python scripts/bump_version.py minor    # 0.1.0 -> 0.2.0
    python scripts/bump_version.py major    # 0.1.0 -> 1.0.0
    python scripts/bump_version.py --version 1.0.0  # Set specific version
    
Options:
    --dry-run      Show changes without applying them
    --no-git       Skip git tagging
    --no-commit    Skip creating commit
"""

import re
import sys
import os
import argparse
import subprocess
from pathlib import Path
from datetime import datetime
from typing import List, Tuple, Optional


class VersionBumper:
    def __init__(self, root_dir: Path):
        self.root_dir = root_dir
        self.current_version = self._get_current_version()
        
    def _get_current_version(self) -> str:
        """Extract current version from __init__.py"""
        init_file = self.root_dir / "claude_code_sdk" / "__init__.py"
        if not init_file.exists():
            raise FileNotFoundError(f"Cannot find {init_file}")
            
        content = init_file.read_text(encoding='utf-8')
        match = re.search(r'__version__\s*=\s*["\']([^"\']+)["\']', content)
        if not match:
            raise ValueError("Cannot find __version__ in __init__.py")
            
        return match.group(1)
    
    def _parse_version(self, version: str) -> Tuple[int, int, int]:
        """Parse semantic version string into tuple"""
        try:
            parts = version.split('.')
            if len(parts) != 3:
                raise ValueError(f"Invalid version format: {version}")
            return tuple(int(p) for p in parts)
        except ValueError as e:
            raise ValueError(f"Invalid version format: {version}") from e
    
    def _format_version(self, major: int, minor: int, patch: int) -> str:
        """Format version tuple as string"""
        return f"{major}.{minor}.{patch}"
    
    def bump_version(self, bump_type: str) -> str:
        """Bump version based on type (major/minor/patch)"""
        major, minor, patch = self._parse_version(self.current_version)
        
        if bump_type == "major":
            major += 1
            minor = 0
            patch = 0
        elif bump_type == "minor":
            minor += 1
            patch = 0
        elif bump_type == "patch":
            patch += 1
        else:
            raise ValueError(f"Invalid bump type: {bump_type}")
            
        return self._format_version(major, minor, patch)
    
    def set_version(self, new_version: str) -> str:
        """Set specific version (validates format)"""
        self._parse_version(new_version)  # Validate format
        return new_version
    
    def update_files(self, new_version: str, dry_run: bool = False) -> List[str]:
        """Update version in all relevant files"""
        updated_files = []
        
        files_to_update = [
            # __init__.py
            {
                'file': self.root_dir / "claude_code_sdk" / "__init__.py",
                'pattern': r'__version__\s*=\s*["\']([^"\']+)["\']',
                'replacement': f'__version__ = "{new_version}"'
            },
            # setup.py
            {
                'file': self.root_dir / "setup.py",
                'pattern': r'version\s*=\s*["\']([^"\']+)["\']',
                'replacement': f'version="{new_version}"'
            },
        ]
        
        for file_info in files_to_update:
            file_path = file_info['file']
            if not file_path.exists():
                print(f"Warning: {file_path} not found, skipping")
                continue
                
            content = file_path.read_text(encoding='utf-8')
            original_content = content
            
            # Apply replacement
            content = re.sub(
                file_info['pattern'], 
                file_info['replacement'], 
                content
            )
            
            if content != original_content:
                if not dry_run:
                    file_path.write_text(content, encoding='utf-8')
                updated_files.append(str(file_path.relative_to(self.root_dir)))
                print(f"Updated: {file_path.relative_to(self.root_dir)}")
            else:
                print(f"No changes needed: {file_path.relative_to(self.root_dir)}")
        
        return updated_files
    
    def update_changelog(self, new_version: str, dry_run: bool = False) -> bool:
        """Update CHANGELOG.md with new version"""
        changelog_file = self.root_dir / "CHANGELOG.md"
        if not changelog_file.exists():
            print("Warning: CHANGELOG.md not found, skipping")
            return False
            
        content = changelog_file.read_text(encoding='utf-8')
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Replace [Unreleased] section with new version
        unreleased_pattern = r'## \[Unreleased\]'
        if re.search(unreleased_pattern, content):
            new_content = re.sub(
                unreleased_pattern,
                f'## [Unreleased]\n\n### Added\n### Changed\n### Fixed\n### Deprecated\n### Removed\n### Security\n\n## [{new_version}] - {today}',
                content
            )
            
            if not dry_run:
                changelog_file.write_text(new_content, encoding='utf-8')
            print(f"Updated: {changelog_file.relative_to(self.root_dir)}")
            return True
        else:
            print("Warning: Could not find [Unreleased] section in CHANGELOG.md")
            return False
    
    def create_git_tag(self, version: str, dry_run: bool = False, no_git: bool = False) -> bool:
        """Create git tag for the version"""
        if no_git:
            print("Skipping git operations (--no-git)")
            return True
            
        tag_name = f"v{version}"
        
        try:
            # Check if tag already exists
            result = subprocess.run(
                ["git", "tag", "-l", tag_name],
                cwd=self.root_dir,
                capture_output=True,
                text=True
            )
            
            if result.stdout.strip():
                print(f"Warning: Git tag {tag_name} already exists")
                return False
            
            if not dry_run:
                # Create annotated tag
                subprocess.run(
                    ["git", "tag", "-a", tag_name, "-m", f"Release {version}"],
                    cwd=self.root_dir,
                    check=True
                )
                print(f"Created git tag: {tag_name}")
            else:
                print(f"Would create git tag: {tag_name}")
            
            return True
            
        except subprocess.CalledProcessError as e:
            print(f"Error creating git tag: {e}")
            return False
    
    def commit_changes(self, version: str, files: List[str], dry_run: bool = False, no_commit: bool = False) -> bool:
        """Commit version changes"""
        if no_commit:
            print("Skipping git commit (--no-commit)")
            return True
            
        try:
            if not dry_run:
                # Add changed files
                for file in files:
                    subprocess.run(
                        ["git", "add", file],
                        cwd=self.root_dir,
                        check=True
                    )
                
                # Add CHANGELOG.md if it exists
                changelog_file = "CHANGELOG.md"
                if (self.root_dir / changelog_file).exists():
                    subprocess.run(
                        ["git", "add", changelog_file],
                        cwd=self.root_dir,
                        check=True
                    )
                
                # Commit changes
                commit_message = f"Bump version to {version}"
                subprocess.run(
                    ["git", "commit", "-m", commit_message],
                    cwd=self.root_dir,
                    check=True
                )
                print(f"Created commit: {commit_message}")
            else:
                print(f"Would commit: Bump version to {version}")
            
            return True
            
        except subprocess.CalledProcessError as e:
            print(f"Error committing changes: {e}")
            return False


def main():
    parser = argparse.ArgumentParser(description="Bump version for Claude Code Python SDK")
    parser.add_argument(
        "bump_type", 
        nargs="?",
        choices=["major", "minor", "patch"],
        help="Type of version bump"
    )
    parser.add_argument(
        "--version", 
        help="Set specific version instead of bumping"
    )
    parser.add_argument(
        "--dry-run", 
        action="store_true",
        help="Show what would be changed without making changes"
    )
    parser.add_argument(
        "--no-git", 
        action="store_true",
        help="Skip git tagging"
    )
    parser.add_argument(
        "--no-commit", 
        action="store_true",
        help="Skip creating commit"
    )
    
    args = parser.parse_args()
    
    # Validate arguments
    if not args.version and not args.bump_type:
        parser.error("Must specify either bump type (major/minor/patch) or --version")
    
    if args.version and args.bump_type:
        parser.error("Cannot specify both bump type and --version")
    
    # Initialize version bumper
    root_dir = Path(__file__).parent.parent
    bumper = VersionBumper(root_dir)
    
    print(f"Current version: {bumper.current_version}")
    
    try:
        # Determine new version
        if args.version:
            new_version = bumper.set_version(args.version)
        else:
            new_version = bumper.bump_version(args.bump_type)
        
        print(f"New version: {new_version}")
        
        if args.dry_run:
            print("\n--- DRY RUN MODE ---")
        
        # Update files
        print("\nUpdating files...")
        updated_files = bumper.update_files(new_version, args.dry_run)
        
        # Update changelog
        print("\nUpdating changelog...")
        bumper.update_changelog(new_version, args.dry_run)
        
        # Git operations
        if not args.dry_run:
            print("\nGit operations...")
            bumper.commit_changes(new_version, updated_files, args.dry_run, args.no_commit)
            bumper.create_git_tag(new_version, args.dry_run, args.no_git)
        
        print(f"\n[SUCCESS] Version successfully {'would be ' if args.dry_run else ''}bumped to {new_version}")
        
        if not args.dry_run and not args.no_git:
            print(f"\nNext steps:")
            print(f"  git push origin main")
            print(f"  git push origin v{new_version}")
        
    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()