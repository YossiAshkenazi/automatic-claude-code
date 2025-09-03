"""
User consent and privacy management for Claude Code SDK metrics.

This module handles user consent collection and privacy settings management
in compliance with GDPR and other privacy regulations.
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class PrivacySettings:
    """Privacy settings configuration."""
    
    def __init__(self):
        """Initialize privacy settings with secure defaults."""
        self.anonymize_paths = True
        self.exclude_env_vars = True
        self.hash_machine_id = True
        self.minimize_data_collection = True
        self.auto_delete_after_days = 90
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert privacy settings to dictionary."""
        return {
            'anonymize_paths': self.anonymize_paths,
            'exclude_env_vars': self.exclude_env_vars,
            'hash_machine_id': self.hash_machine_id,
            'minimize_data_collection': self.minimize_data_collection,
            'auto_delete_after_days': self.auto_delete_after_days
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'PrivacySettings':
        """Create privacy settings from dictionary."""
        settings = cls()
        settings.anonymize_paths = data.get('anonymize_paths', True)
        settings.exclude_env_vars = data.get('exclude_env_vars', True)
        settings.hash_machine_id = data.get('hash_machine_id', True)
        settings.minimize_data_collection = data.get('minimize_data_collection', True)
        settings.auto_delete_after_days = data.get('auto_delete_after_days', 90)
        return settings


class ConsentManager:
    """Manages user consent and privacy preferences."""
    
    def __init__(self, consent_file_path: Optional[Path] = None):
        """Initialize consent manager.
        
        Args:
            consent_file_path: Path to consent file (defaults to user config dir)
        """
        self.consent_file_path = consent_file_path or (
            Path.home() / '.claude-code-sdk' / 'consent.json'
        )
        self._consent_data = self._load_consent()
    
    def _load_consent(self) -> Dict[str, Any]:
        """Load consent data from file."""
        if self.consent_file_path.exists():
            try:
                with open(self.consent_file_path, 'r') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                logger.warning(f"Failed to load consent data: {e}")
        
        # Default consent data
        return {
            'consent_version': '1.0',
            'consent_given': False,
            'consent_timestamp': None,
            'data_types_consented': [],
            'privacy_settings': PrivacySettings().to_dict(),
            'withdrawal_timestamp': None
        }
    
    def _save_consent(self) -> None:
        """Save consent data to file."""
        self.consent_file_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with open(self.consent_file_path, 'w') as f:
                json.dump(self._consent_data, f, indent=2)
        except IOError as e:
            logger.error(f"Failed to save consent data: {e}")
    
    def show_consent_banner(self) -> str:
        """Generate consent banner text.
        
        Returns:
            Formatted consent banner text
        """
        banner = """
╔══════════════════════════════════════════════════════════════════╗
║                    Claude Code SDK - Privacy Notice              ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║ We value your privacy! The Claude Code SDK can collect          ║
║ anonymized usage data to help improve the product.              ║
║                                                                  ║
║ Data we may collect (with your consent):                        ║
║ • Usage statistics (features used, success rates)               ║
║ • Performance metrics (execution times, resource usage)         ║
║ • Error reports (anonymized stack traces)                       ║
║                                                                  ║
║ We DO NOT collect:                                               ║
║ • Personal information or file contents                         ║
║ • Sensitive environment variables                               ║
║ • File paths or directory structures                            ║
║                                                                  ║
║ All data is:                                                     ║
║ • Anonymized and aggregated                                      ║
║ • Stored securely with encryption                               ║
║ • Automatically deleted after 90 days                           ║
║ • Available for export/deletion upon request                    ║
║                                                                  ║
║ You can withdraw consent at any time using:                     ║
║   claude-code-sdk privacy withdraw                               ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝

Would you like to enable anonymous usage analytics? [y/N]: """
        return banner
    
    def request_consent(self, data_types: Optional[list] = None) -> bool:
        """Request user consent for data collection.
        
        Args:
            data_types: List of data types to request consent for
            
        Returns:
            True if consent is given
        """
        if data_types is None:
            data_types = ['usage_analytics', 'error_reporting', 'performance_metrics']
        
        # If consent already given for these data types, return True
        consented_types = set(self._consent_data.get('data_types_consented', []))
        requested_types = set(data_types)
        
        if requested_types.issubset(consented_types) and self._consent_data.get('consent_given'):
            return True
        
        # Show consent banner and request input
        print(self.show_consent_banner())
        
        try:
            response = input().strip().lower()
            consent_given = response in ['y', 'yes']
            
            if consent_given:
                self.grant_consent(data_types)
                print("\n✅ Thank you! Analytics enabled with privacy protection.")
            else:
                print("\n❌ Analytics disabled. You can enable it later with: claude-code-sdk privacy enable")
            
            return consent_given
            
        except (KeyboardInterrupt, EOFError):
            print("\n❌ Analytics disabled.")
            return False
    
    def grant_consent(self, data_types: list) -> None:
        """Grant consent for specified data types.
        
        Args:
            data_types: List of data types to grant consent for
        """
        self._consent_data.update({
            'consent_given': True,
            'consent_timestamp': datetime.now(timezone.utc).isoformat(),
            'data_types_consented': list(set(
                self._consent_data.get('data_types_consented', []) + data_types
            )),
            'withdrawal_timestamp': None
        })
        self._save_consent()
    
    def withdraw_consent(self) -> None:
        """Withdraw consent for all data collection."""
        self._consent_data.update({
            'consent_given': False,
            'withdrawal_timestamp': datetime.now(timezone.utc).isoformat(),
            'data_types_consented': []
        })
        self._save_consent()
    
    def update_privacy_settings(self, settings: PrivacySettings) -> None:
        """Update privacy settings.
        
        Args:
            settings: New privacy settings
        """
        self._consent_data['privacy_settings'] = settings.to_dict()
        self._save_consent()
    
    def has_consent(self, data_type: str = None) -> bool:
        """Check if consent has been given.
        
        Args:
            data_type: Specific data type to check (optional)
            
        Returns:
            True if consent has been given
        """
        if not self._consent_data.get('consent_given'):
            return False
        
        if data_type:
            return data_type in self._consent_data.get('data_types_consented', [])
        
        return True
    
    def get_privacy_settings(self) -> PrivacySettings:
        """Get current privacy settings.
        
        Returns:
            Current privacy settings
        """
        settings_data = self._consent_data.get('privacy_settings', {})
        return PrivacySettings.from_dict(settings_data)
    
    def get_consent_info(self) -> Dict[str, Any]:
        """Get consent information for display.
        
        Returns:
            Dictionary with consent information
        """
        return {
            'consent_given': self._consent_data.get('consent_given', False),
            'consent_date': self._consent_data.get('consent_timestamp'),
            'data_types': self._consent_data.get('data_types_consented', []),
            'privacy_settings': self._consent_data.get('privacy_settings', {}),
            'withdrawal_date': self._consent_data.get('withdrawal_timestamp')
        }
    
    def export_consent_data(self) -> Dict[str, Any]:
        """Export all consent and privacy data for GDPR compliance.
        
        Returns:
            Complete consent data
        """
        return {
            'consent_data': self._consent_data,
            'export_timestamp': datetime.now(timezone.utc).isoformat(),
            'privacy_rights': {
                'data_portability': True,
                'right_to_erasure': True,
                'right_to_rectification': True,
                'right_of_access': True
            }
        }
    
    def delete_all_data(self) -> bool:
        """Delete all consent and analytics data.
        
        Returns:
            True if data was successfully deleted
        """
        try:
            if self.consent_file_path.exists():
                self.consent_file_path.unlink()
            
            # Also delete analytics config if it exists
            analytics_config_path = Path.home() / '.claude-code-sdk' / 'analytics.json'
            if analytics_config_path.exists():
                analytics_config_path.unlink()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete data: {e}")
            return False