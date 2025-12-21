# Scripts Documentation

This document describes all scripts used for server-side data aggregation.

## Single Entry Point

### `generate_aggregations.py` (Main Script)

**Location**: Project root directory  
**Purpose**: Single entry point for generating all server-side aggregations

**Usage**:
```bash
python3 generate_aggregations.py
```

Or make it executable:
```bash
chmod +x generate_aggregations.py
./generate_aggregations.py
```

**What it does**:
1. ✅ Checks Python version (requires 3.8+)
2. ✅ Validates CSV file exists (`ticket-list-export.csv`)
3. ✅ Checks/creates output directory (`data/`)
4. ✅ Executes the aggregation script
5. ✅ Verifies output files were generated
6. ✅ Provides summary and next steps

**Features**:
- Color-coded terminal output for easy reading
- Step-by-step progress indicators
- File validation and verification
- Clear error messages
- Summary of generated files

**When to use**:
- **Primary method**: Use this script whenever you need to regenerate aggregations
- After replacing the CSV file with new data
- After making changes to aggregation logic
- For initial setup

---

## Internal Scripts

### `scripts/process_csv.py` (Core Aggregation Engine)

**Location**: `scripts/process_csv.py`  
**Purpose**: Core script that performs all data processing and aggregation

**What it does**:
1. Reads and parses `ticket-list-export.csv`
2. Cleans customer names (removes brackets)
3. Identifies unique customers and years
4. Generates metadata (`metadata.json`)
5. Creates aggregated JSON files for:
   - All customers
   - One Albania (aggregated)
   - Rest of the World
   - Individual customers
   - Weekly and monthly periods
   - Customer distribution (for pie chart)

**Generated Files**:
- `metadata.json` - Contains customers list, years, and metadata
- `weekly-{year}-{customer}.json` - Weekly aggregations (~110 files)
- `monthly-{year}-{customer}.json` - Monthly aggregations (~110 files)
- `customer-distribution-{year}-{range}.json` - Customer distribution (~30 files)

**Total**: ~251 JSON files

**Note**: This script is called automatically by `generate_aggregations.py`. You typically don't need to run it directly.

---

## Workflow

### Updating Data

1. **Replace CSV file**:
   ```bash
   # Replace ticket-list-export.csv with new data
   cp /path/to/new-data.csv ticket-list-export.csv
   ```

2. **Run aggregation script**:
   ```bash
   python3 generate_aggregations.py
   ```

3. **Verify output**:
   - Check that `data/metadata.json` was updated
   - Verify JSON files were regenerated
   - Test dashboard locally

### File Structure

```
amc-reports/
├── generate_aggregations.py    # ← Single entry point (run this)
├── ticket-list-export.csv      # ← Input CSV file
├── scripts/
│   └── process_csv.py          # ← Core aggregation engine (called automatically)
└── data/                       # ← Output directory
    ├── metadata.json
    ├── weekly-*.json
    ├── monthly-*.json
    └── customer-distribution-*.json
```

---

## Script Dependencies

### Python Requirements
- Python 3.8 or higher
- Standard library only (no external dependencies):
  - `csv`
  - `json`
  - `re`
  - `datetime`
  - `collections`
  - `pathlib`
  - `subprocess` (for entry point script)

### Input Requirements
- CSV file: `ticket-list-export.csv` in project root
- Required CSV columns:
  - `Created` - Ticket creation date
  - `Custom field (Closure Date)` - Ticket resolution date
  - `Custom field (PS Customer Name)` - Customer name
  - `Issue key` - Jira ticket key

---

## Troubleshooting

### CSV File Not Found
```
Error: CSV file not found: /path/to/ticket-list-export.csv
```
**Solution**: Ensure `ticket-list-export.csv` is in the project root directory.

### Python Version Too Old
```
Error: Python 3.8 or higher is required. Current version: 3.6
```
**Solution**: Upgrade Python to 3.8 or higher.

### Aggregation Script Fails
Check the error output from `scripts/process_csv.py`. Common issues:
- Invalid date formats in CSV
- Missing required columns
- Corrupted CSV file

---

## Summary

**For regular use**: Run `generate_aggregations.py` - it handles everything automatically.

**For debugging**: Check `scripts/process_csv.py` if you need to understand the aggregation logic.

