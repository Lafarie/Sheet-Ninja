"""
Dynamic Column Manager for Google Sheets
This utility helps manage and configure column mappings dynamically
"""

import os
import json
import config
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

class ColumnManager:
    def __init__(self):
        self.spreadsheet_id = config.SPREADSHEET_ID
        self.service = self._authenticate()
        self.current_config = config.COLUMN_CONFIG.copy()
        print("✅ Column Manager initialized")
    
    def _authenticate(self):
        """Authenticate with Google Sheets"""
        credentials = service_account.Credentials.from_service_account_file(
            config.SERVICE_ACCOUNT_FILE,
            scopes=config.SCOPES
        )
        return build('sheets', 'v4', credentials=credentials)
    
    def detect_current_headers(self):
        """Auto-detect current headers from the Google Sheet"""
        try:
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=f"{config.WORKSHEET_NAME}!1:1"
            ).execute()
            
            values = result.get('values', [])
            if values:
                headers = values[0]
                print(f"📊 Detected {len(headers)} headers in sheet:")
                for i, header in enumerate(headers, 1):
                    print(f"   Column {chr(64 + i)} ({i}): {header}")
                return headers
            else:
                print("⚠️ No headers found in sheet")
                return []
        except Exception as e:
            print(f"❌ Error detecting headers: {e}")
            return []
    
    def auto_map_columns(self):
        """Automatically map columns based on detected headers"""
        detected_headers = self.detect_current_headers()
        if not detected_headers:
            return False
        
        # Create mapping suggestions
        mapping_suggestions = {}
        
        for i, header in enumerate(detected_headers, 1):
            header_lower = header.strip().lower()
            
            # Try to find exact or close matches
            for key, config_data in self.current_config.items():
                config_header = config_data["header"].lower()
                
                # Exact match
                if header_lower == config_header:
                    mapping_suggestions[key] = {
                        "old_index": config_data["index"],
                        "new_index": i,
                        "header": header,
                        "confidence": "exact"
                    }
                    break
                # Partial match (contains key words)
                elif any(word in header_lower for word in config_header.split()):
                    if key not in mapping_suggestions:  # Don't override exact matches
                        mapping_suggestions[key] = {
                            "old_index": config_data["index"],
                            "new_index": i,
                            "header": header,
                            "confidence": "partial"
                        }
        
        print("\n🔍 Auto-mapping suggestions:")
        print("-" * 60)
        for key, suggestion in mapping_suggestions.items():
            old_header = self.current_config[key]["header"]
            confidence_icon = "✅" if suggestion["confidence"] == "exact" else "🔍"
            print(f"{confidence_icon} {key}:")
            print(f"   Old: Column {suggestion['old_index']} - '{old_header}'")
            print(f"   New: Column {suggestion['new_index']} - '{suggestion['header']}'")
        
        return mapping_suggestions
    
    def apply_mapping(self, mapping_suggestions, auto_apply=False):
        """Apply the suggested column mappings"""
        if not mapping_suggestions:
            print("❌ No mapping suggestions to apply")
            return False
        
        if not auto_apply:
            print("\n📋 Review mapping suggestions above.")
            confirm = input("Apply these mappings? (y/n): ").strip().lower()
            if confirm != 'y':
                print("❌ Mapping cancelled by user")
                return False
        
        # Apply mappings
        updated_config = self.current_config.copy()
        for key, suggestion in mapping_suggestions.items():
            updated_config[key]["index"] = suggestion["new_index"]
            # Optionally update header name to match sheet
            updated_config[key]["header"] = suggestion["header"]
        
        # Save updated configuration
        if config.save_column_config(updated_config):
            print("✅ Column mapping applied successfully!")
            
            # Reload config in memory
            config.COLUMN_CONFIG = updated_config
            config.COLUMNS = {key: value["index"] for key, value in updated_config.items()}
            config.SHEET_HEADERS = config.get_sheet_headers()
            
            return True
        else:
            print("❌ Failed to save column configuration")
            return False
    
    def interactive_column_setup(self):
        """Interactive setup for column configuration with auto-detection"""
        print("\n🔧 Interactive Column Configuration with Auto-Detection")
        print("=" * 60)
        
        # First, detect headers from the actual spreadsheet
        detected_headers = self.detect_current_headers()
        if not detected_headers:
            print("❌ Cannot detect headers from spreadsheet. Please check:")
            print("   - Spreadsheet ID is correct")
            print("   - Service account has access to the sheet")
            print("   - Worksheet name is correct")
            return False
        
        print(f"\n📊 Detected {len(detected_headers)} headers from your spreadsheet:")
        for i, header in enumerate(detected_headers, 1):
            print(f"   {i}. {header}")
        
        # Auto-map columns based on detected headers
        print("\n🔍 Auto-mapping columns...")
        auto_mappings = self.auto_map_columns()
        
        if auto_mappings:
            print(f"\n✅ Auto-mapped {len(auto_mappings)} columns:")
            for key, mapping in auto_mappings.items():
                confidence_icon = "✅" if mapping["confidence"] == "exact" else "🔍"
                print(f"   {confidence_icon} {key}: Column {mapping['new_index']} - '{mapping['header']}' ({mapping['confidence']} match)")
        else:
            print("\n⚠️ No automatic mappings found. You may need to map manually.")
        
        # Show current configuration
        print("\n📋 Current configuration:")
        for key, config_data in config.get_column_order():
            auto_mapped = key in auto_mappings
            status_icon = "✅" if auto_mapped else "❌"
            print(f"   {status_icon} {key}: Column {config_data['index']} - '{config_data['header']}'")
        
        # Ask if user wants to apply auto-mappings
        if auto_mappings:
            print(f"\n💡 {len(auto_mappings)} columns can be auto-mapped.")
            apply_auto = input("Apply auto-mappings? (y/n): ").strip().lower()
            
            if apply_auto == 'y':
                return self.apply_mapping(auto_mappings, auto_apply=True)
        
        # Manual configuration option
        print("\n🔧 Manual configuration options:")
        print("1. Apply auto-mappings and continue with manual adjustments")
        print("2. Start fresh with manual mapping")
        print("3. Cancel and keep current configuration")
        
        choice = input("\nEnter choice (1-3): ").strip()
        
        if choice == '1':
            # Apply auto-mappings first, then allow manual adjustments
            if auto_mappings:
                self.apply_mapping(auto_mappings, auto_apply=True)
            return self.manual_column_adjustment(detected_headers)
        elif choice == '2':
            return self.manual_column_adjustment(detected_headers)
        else:
            print("❌ Configuration cancelled")
            return False
    
    def manual_column_adjustment(self, detected_headers):
        """Allow manual adjustment of column mappings"""
        print("\n🔧 Manual Column Adjustment")
        print("=" * 40)
        
        updated_config = self.current_config.copy()
        
        print(f"\n📊 Available columns in your sheet:")
        for i, header in enumerate(detected_headers, 1):
            print(f"   {i}. {header}")
        
        print("\n🔧 Configure each column (press Enter to skip):")
        print("-" * 50)
        
        for key, config_data in updated_config.items():
            current_index = config_data["index"]
            current_header = config_data["header"]
            required = config_data.get("required", False)
            required_text = " (REQUIRED)" if required else ""
            
            print(f"\n📌 {key}{required_text}")
            print(f"   Description: {config_data.get('description', 'N/A')}")
            print(f"   Current: Column {current_index} - '{current_header}'")
            
            new_index = input(f"   New column number (1-{len(detected_headers)}) or Enter to keep current: ").strip()
            
            if new_index.isdigit():
                new_index = int(new_index)
                if 1 <= new_index <= len(detected_headers):
                    updated_config[key]["index"] = new_index
                    updated_config[key]["header"] = detected_headers[new_index - 1]
                    print(f"   ✅ Updated: Column {new_index} - '{detected_headers[new_index - 1]}'")
                else:
                    print(f"   ⚠️ Invalid column number. Keeping current configuration.")
        
        # Show final configuration
        print("\n📋 Final Configuration:")
        print("-" * 50)
        ordered_config = sorted(updated_config.items(), key=lambda x: x[1]["index"])
        for key, config_data in ordered_config:
            print(f"   Column {config_data['index']}: {key} - '{config_data['header']}'")
        
        # Confirm and save
        confirm = input("\n💾 Save this configuration? (y/n): ").strip().lower()
        if confirm == 'y':
            if config.save_column_config(updated_config):
                print("✅ Configuration saved successfully!")
                
                # Reload config in memory
                config.COLUMN_CONFIG = updated_config
                config.COLUMNS = {key: value["index"] for key, value in updated_config.items()}
                config.SHEET_HEADERS = config.get_sheet_headers()
                
                return True
            else:
                print("❌ Failed to save configuration")
                return False
        else:
            print("❌ Configuration not saved")
            return False
    
    def validate_configuration(self):
        """Validate current column configuration against sheet"""
        detected_headers = self.detect_current_headers()
        if not detected_headers:
            return False
        
        print("\n🔍 Validating current configuration...")
        print("-" * 50)
        
        issues_found = []
        
        for key, config_data in self.current_config.items():
            expected_index = config_data["index"]
            expected_header = config_data["header"]
            required = config_data.get("required", False)
            
            # Check if index is within range
            if expected_index > len(detected_headers):
                issues_found.append(f"❌ {key}: Column {expected_index} doesn't exist (only {len(detected_headers)} columns)")
                continue
            
            # Check header match
            actual_header = detected_headers[expected_index - 1]
            if actual_header.lower().strip() != expected_header.lower().strip():
                icon = "❌" if required else "⚠️"
                issues_found.append(f"{icon} {key}: Expected '{expected_header}' but found '{actual_header}' in column {expected_index}")
            else:
                print(f"✅ {key}: Column {expected_index} - '{actual_header}' ✓")
        
        if issues_found:
            print("\n🚨 Issues found:")
            for issue in issues_found:
                print(f"   {issue}")
            
            print("\n💡 Suggestions:")
            print("   1. Run auto_map_columns() to get mapping suggestions")
            print("   2. Run interactive_column_setup() for manual configuration")
            print("   3. Check your Google Sheet headers")
            
            return False
        else:
            print("\n✅ Configuration is valid!")
            return True
    
    def export_configuration(self, filename=None):
        """Export current configuration to a file"""
        if not filename:
            filename = f"column_config_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        try:
            filepath = os.path.join(config.ROOT_DIR, filename)
            with open(filepath, 'w') as f:
                json.dump(self.current_config, f, indent=2)
            print(f"✅ Configuration exported to: {filepath}")
            return filepath
        except Exception as e:
            print(f"❌ Export failed: {e}")
            return None
    
    def import_configuration(self, filepath):
        """Import configuration from a file"""
        try:
            if not os.path.exists(filepath):
                print(f"❌ File not found: {filepath}")
                return False
            
            with open(filepath, 'r') as f:
                imported_config = json.load(f)
            
            # Validate imported config
            if not isinstance(imported_config, dict):
                print("❌ Invalid configuration format")
                return False
            
            # Apply imported configuration
            if config.save_column_config(imported_config):
                config.COLUMN_CONFIG = imported_config
                config.COLUMNS = {key: value["index"] for key, value in imported_config.items()}
                config.SHEET_HEADERS = config.get_sheet_headers()
                print(f"✅ Configuration imported from: {filepath}")
                return True
            else:
                print("❌ Failed to save imported configuration")
                return False
        except Exception as e:
            print(f"❌ Import failed: {e}")
            return False
    
    def reset_to_defaults(self):
        """Reset configuration to defaults"""
        confirm = input("⚠️ Reset to default configuration? This will lose all customizations (y/n): ").strip().lower()
        if confirm == 'y':
            if config.save_column_config(config.DEFAULT_COLUMN_CONFIG):
                config.COLUMN_CONFIG = config.DEFAULT_COLUMN_CONFIG.copy()
                config.COLUMNS = {key: value["index"] for key, value in config.COLUMN_CONFIG.items()}
                config.SHEET_HEADERS = config.get_sheet_headers()
                print("✅ Configuration reset to defaults")
                return True
            else:
                print("❌ Failed to reset configuration")
                return False
        else:
            print("❌ Reset cancelled")
            return False

def main():
    """Main menu for column management"""
    print("🔧 Google Sheets Column Manager")
    print("=" * 40)
    
    try:
        manager = ColumnManager()
        
        while True:
            print("\n📋 Choose an option:")
            print("1. 🔍 Auto-detect and map columns")
            print("2. ⚙️ Interactive column setup")
            print("3. ✅ Validate current configuration")
            print("4. 📊 Show current configuration")
            print("5. 📤 Export configuration")
            print("6. 📥 Import configuration")
            print("7. 🔄 Reset to defaults")
            print("8. 🚪 Exit")
            
            choice = input("\nEnter choice (1-8): ").strip()
            
            if choice == '1':
                suggestions = manager.auto_map_columns()
                if suggestions:
                    manager.apply_mapping(suggestions)
            
            elif choice == '2':
                manager.interactive_column_setup()
            
            elif choice == '3':
                manager.validate_configuration()
            
            elif choice == '4':
                print("\n📊 Current Configuration:")
                print("-" * 50)
                for key, config_data in config.get_column_order():
                    required = " (REQUIRED)" if config_data.get("required", False) else ""
                    print(f"   Column {config_data['index']}: {key}{required}")
                    print(f"      Header: '{config_data['header']}'")
                    print(f"      Type: {config_data.get('data_type', 'text')}")
                    print(f"      Description: {config_data.get('description', 'N/A')}")
                    print()
            
            elif choice == '5':
                filename = input("Export filename (Enter for auto-generated): ").strip()
                manager.export_configuration(filename if filename else None)
            
            elif choice == '6':
                filepath = input("Import filepath: ").strip()
                manager.import_configuration(filepath)
            
            elif choice == '7':
                manager.reset_to_defaults()
            
            elif choice == '8':
                print("👋 Goodbye!")
                break
            
            else:
                print("❌ Invalid choice. Please try again.")
    
    except KeyboardInterrupt:
        print("\n\n👋 Goodbye!")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    from datetime import datetime
    main()
