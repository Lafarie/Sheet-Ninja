# Dynamic Column Management System

## Overview

This system provides flexible, dynamic column mapping for Google Sheets integration with GitLab. It automatically adapts to changes in column positions and names, making the scripts more robust and user-friendly.

## Features

### 🔄 Dynamic Column Mapping
- Automatically detects column positions from Google Sheets
- Maps columns by header names instead of fixed positions
- Handles column reordering without code changes
- Provides fallback mechanisms for missing columns

### 🔧 Interactive Management
- **Column Manager UI**: Interactive tool for configuring column mappings
- **Auto-detection**: Automatically suggests column mappings based on headers
- **Validation**: Checks configuration against actual sheet structure
- **Export/Import**: Backup and restore column configurations

### 📊 Flexible Configuration
- **JSON-based storage**: Column configurations saved in `custom_columns.json`
- **Metadata support**: Each column includes type, description, and requirements
- **Default fallbacks**: Built-in default configuration if custom config is missing

## Files

### Core Files
- `config.py` - Enhanced configuration with dynamic column support
- `column_manager.py` - Interactive column management utility
- `sheets_to_gitlab.py` - Updated to use dynamic column mapping
- `setup/setup_sheet_dropdown.py` - Updated dropdown setup with dynamic columns

### Configuration Files
- `custom_columns.json` - Your custom column configuration (auto-generated)
- `column_config_backup_*.json` - Backup files created during export

## Quick Start

### 1. First Time Setup
```bash
# Run the column manager to configure your columns
python column_manager.py
```

### 2. Auto-detect Columns
If your Google Sheet already has headers:
```
Choose option 1: Auto-detect and map columns
```

### 3. Interactive Setup
For custom configuration:
```
Choose option 2: Interactive column setup
```

### 4. Validate Configuration
Check if everything is working:
```
Choose option 3: Validate current configuration
```

## Column Configuration Structure

Each column has the following properties:

```json
{
  "COLUMN_KEY": {
    "index": 1,                    // Column position (1-based)
    "header": "Column Header",     // Expected header name
    "required": true,              // Whether column is required
    "data_type": "text",          // Data type (text, date, number, dropdown)
    "description": "Description",  // Human-readable description
    "example": "Example value"     // Example of expected data
  }
}
```

## Default Column Configuration

| Column Key | Default Position | Header | Type | Required |
|------------|------------------|--------|------|----------|
| DATE | 1 (A) | Date | date | ✅ |
| GIT_ID | 2 (B) | GIT ID | text | ❌ |
| PROJECT_NAME | 3 (C) | Project Name | dropdown | ✅ |
| SPECIFIC_PROJECT | 4 (D) | Specific Project Name | dropdown | ❌ |
| MAIN_TASK | 5 (E) | Main Task | text | ✅ |
| SUB_TASK | 6 (F) | Sub Task | text | ✅ |
| STATUS | 7 (G) | Status | dropdown | ✅ |
| START_DATE | 8 (H) | Actual Start Date | date | ❌ |
| PLANNED_ESTIMATION | 9 (I) | Planned Estimation (H) | number | ❌ |
| ACTUAL_ESTIMATION | 10 (J) | Actual Estimation (H) | number | ❌ |
| END_DATE | 11 (K) | Actual End Date | date | ❌ |

## Usage Examples

### Auto-Detection
When your sheet structure changes, the system will:
1. Detect current headers
2. Compare with expected configuration
3. Suggest mappings for mismatched columns
4. Allow you to apply changes automatically

### Manual Configuration
You can manually map each column:
```
📌 PROJECT_NAME (REQUIRED)
   Description: Project selection
   Current: Column 3 - 'Project Name'
   New column number (1-11) or Enter to keep current: 5
   ✅ Updated: Column 5 - 'Project Title'
```

### Validation
The system checks for common issues:
- Missing required columns
- Header name mismatches
- Columns outside sheet range
- Provides suggestions for fixes

## API Functions

### Configuration Functions
```python
import config

# Get current column mapping
columns = config.COLUMNS

# Get column by header name
column_key = config.get_column_by_header("Project Name")

# Get header by column key
header = config.get_header_by_column("PROJECT_NAME")

# Update column position
config.update_column_index("PROJECT_NAME", 5)

# Get required columns
required = config.get_required_columns()

# Get columns in order
ordered = config.get_column_order()
```

### Column Manager Functions
```python
from column_manager import ColumnManager

manager = ColumnManager()

# Auto-detect and map columns
suggestions = manager.auto_map_columns()
manager.apply_mapping(suggestions)

# Validate current configuration
is_valid = manager.validate_configuration()

# Export configuration
backup_path = manager.export_configuration()

# Import configuration
manager.import_configuration("backup.json")
```

## Migration from Fixed Columns

If you're upgrading from the old fixed-column system:

1. **Backup your data** first
2. Run the column manager: `python column_manager.py`
3. Choose option 1 (Auto-detect) to map your existing columns
4. Validate the configuration with option 3
5. Test with a small dataset first

## Troubleshooting

### Common Issues

#### "Column mapping issues detected"
- Run `python column_manager.py`
- Use auto-detection or interactive setup
- Check that your sheet headers match expected names

#### "Configuration file not found"
- This is normal for first-time setup
- Default configuration will be used
- Run column manager to create custom configuration

#### "Invalid column number"
- Make sure column numbers are within your sheet range
- Check that you're using the correct worksheet name
- Verify sheet has the expected headers

### Debug Mode
Add debugging to see what's happening:
```python
# In sheets_to_gitlab.py, the get_sheet_data() method shows:
# - Detected headers
# - Column mapping results
# - Missing or mismatched columns
```

## Best Practices

1. **Regular Validation**: Run validation after any sheet structure changes
2. **Backup Configurations**: Export your configuration before major changes
3. **Test Changes**: Use a copy of your sheet for testing new configurations
4. **Document Changes**: Keep notes about why you changed column mappings
5. **Team Coordination**: Share configuration files with team members

## Advanced Features

### Custom Data Types
You can extend the system with custom data types:
```json
{
  "PRIORITY": {
    "index": 12,
    "header": "Priority",
    "required": false,
    "data_type": "priority_dropdown",
    "options": ["High", "Medium", "Low"]
  }
}
```

### Conditional Columns
Set up columns that are only required under certain conditions:
```json
{
  "ESTIMATED_HOURS": {
    "required_when": {"STATUS": "In Progress"}
  }
}
```

### Multiple Sheet Support
Configure different column mappings for different worksheets:
```python
# In config.py
WORKSHEET_CONFIGS = {
    "Tasks": "custom_columns_tasks.json",
    "Projects": "custom_columns_projects.json"
}
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Run validation to identify specific problems
3. Use the interactive column manager for step-by-step guidance
4. Check the console output for detailed error messages

---

*This dynamic column system makes your Google Sheets integration more robust and user-friendly by adapting to changes automatically.*
