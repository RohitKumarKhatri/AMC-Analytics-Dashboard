#!/usr/bin/env python3
"""
Single Entry Point Script for Generating All Server-Side Aggregations

This script is the main entry point for generating all aggregated JSON data files
from the CSV file. Simply replace the CSV file and run this script to regenerate
all aggregations.

Usage:
    python3 generate_aggregations.py
    
    Or make it executable and run directly:
    chmod +x generate_aggregations.py
    ./generate_aggregations.py

Requirements:
    - Python 3.8 or higher
    - CSV file: ticket-list-export.csv (in project root)
    - All dependencies from scripts/process_csv.py
"""

import sys
import subprocess
from pathlib import Path
from datetime import datetime

# Color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header():
    """Print script header"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}  AMC Analytics Dashboard - Aggregation Generator{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.END}\n")

def print_step(step_num, message):
    """Print a step message"""
    print(f"{Colors.BOLD}[Step {step_num}]{Colors.END} {message}")

def print_success(message):
    """Print success message"""
    print(f"{Colors.GREEN}✓{Colors.END} {message}")

def print_error(message):
    """Print error message"""
    print(f"{Colors.RED}✗{Colors.END} {message}")

def print_warning(message):
    """Print warning message"""
    print(f"{Colors.YELLOW}⚠{Colors.END} {message}")

def check_python_version():
    """Check if Python version is 3.8 or higher"""
    print_step(1, "Checking Python version...")
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print_error(f"Python 3.8 or higher is required. Current version: {version.major}.{version.minor}")
        return False
    print_success(f"Python {version.major}.{version.minor}.{version.micro} detected")
    return True

def check_csv_file():
    """Check if CSV file exists"""
    print_step(2, "Checking for CSV file...")
    script_dir = Path(__file__).parent
    csv_path = script_dir / 'ticket-list-export.csv'
    
    if not csv_path.exists():
        print_error(f"CSV file not found: {csv_path}")
        print_warning("Please ensure 'ticket-list-export.csv' is in the project root directory")
        return None
    
    # Get file size
    file_size = csv_path.stat().st_size
    file_size_mb = file_size / (1024 * 1024)
    
    print_success(f"CSV file found: {csv_path}")
    print(f"  File size: {file_size_mb:.2f} MB")
    
    # Get last modified time
    mtime = csv_path.stat().st_mtime
    mod_time = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
    print(f"  Last modified: {mod_time}")
    
    return csv_path

def check_output_directory():
    """Check and create output directory if needed"""
    print_step(3, "Checking output directory...")
    script_dir = Path(__file__).parent
    output_dir = script_dir / 'data'
    
    if not output_dir.exists():
        output_dir.mkdir(parents=True, exist_ok=True)
        print_success(f"Created output directory: {output_dir}")
    else:
        # Count existing JSON files
        json_files = list(output_dir.glob('*.json'))
        print_success(f"Output directory exists: {output_dir}")
        print(f"  Existing JSON files: {len(json_files)}")
        if json_files:
            print_warning("Existing JSON files will be overwritten")
    
    return output_dir

def run_aggregation_script():
    """Run the main aggregation script"""
    print_step(4, "Running aggregation script...")
    script_dir = Path(__file__).parent
    process_script = script_dir / 'scripts' / 'process_csv.py'
    
    if not process_script.exists():
        print_error(f"Aggregation script not found: {process_script}")
        return False
    
    print(f"  Executing: {process_script}")
    print(f"{Colors.BLUE}{'-'*70}{Colors.END}\n")
    
    try:
        # Run the script and capture output
        result = subprocess.run(
            [sys.executable, str(process_script)],
            cwd=str(script_dir),
            check=True,
            capture_output=False,  # Show output in real-time
            text=True
        )
        
        print(f"\n{Colors.BLUE}{'-'*70}{Colors.END}")
        print_success("Aggregation script completed successfully")
        return True
        
    except subprocess.CalledProcessError as e:
        print_error(f"Aggregation script failed with exit code {e.returncode}")
        return False
    except Exception as e:
        print_error(f"Error running aggregation script: {e}")
        return False

def verify_output():
    """Verify that output files were generated"""
    print_step(5, "Verifying output files...")
    script_dir = Path(__file__).parent
    output_dir = script_dir / 'data'
    
    # Check for metadata.json
    metadata_file = output_dir / 'metadata.json'
    if not metadata_file.exists():
        print_error("metadata.json not found")
        return False
    
    print_success("metadata.json found")
    
    # Count JSON files
    json_files = list(output_dir.glob('*.json'))
    print_success(f"Total JSON files generated: {len(json_files)}")
    
    # Check for customer distribution files
    customer_dist_files = list(output_dir.glob('customer-distribution-*.json'))
    if customer_dist_files:
        print_success(f"Customer distribution files: {len(customer_dist_files)}")
    
    # Check for period files
    weekly_files = list(output_dir.glob('weekly-*.json'))
    monthly_files = list(output_dir.glob('monthly-*.json'))
    if weekly_files:
        print_success(f"Weekly aggregation files: {len(weekly_files)}")
    if monthly_files:
        print_success(f"Monthly aggregation files: {len(monthly_files)}")
    
    return True

def print_summary(csv_path, output_dir):
    """Print summary of the process"""
    print(f"\n{Colors.BOLD}{Colors.GREEN}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.GREEN}  Aggregation Complete!{Colors.END}")
    print(f"{Colors.BOLD}{Colors.GREEN}{'='*70}{Colors.END}\n")
    
    print(f"{Colors.BOLD}Input:{Colors.END}")
    print(f"  CSV File: {csv_path}")
    
    print(f"\n{Colors.BOLD}Output:{Colors.END}")
    print(f"  Data Directory: {output_dir}")
    
    json_files = list(output_dir.glob('*.json'))
    print(f"  Total Files Generated: {len(json_files)}")
    
    print(f"\n{Colors.BOLD}Next Steps:{Colors.END}")
    print(f"  1. Review the generated JSON files in the 'data' directory")
    print(f"  2. Test the dashboard locally or deploy to GitHub Pages")
    print(f"  3. To update data: Replace CSV file and run this script again")
    
    print(f"\n{Colors.BLUE}{'='*70}{Colors.END}\n")

def main():
    """Main function"""
    print_header()
    
    # Step 1: Check Python version
    if not check_python_version():
        sys.exit(1)
    
    # Step 2: Check CSV file
    csv_path = check_csv_file()
    if csv_path is None:
        sys.exit(1)
    
    # Step 3: Check output directory
    output_dir = check_output_directory()
    
    # Step 4: Run aggregation script
    if not run_aggregation_script():
        print_error("Failed to generate aggregations")
        sys.exit(1)
    
    # Step 5: Verify output
    if not verify_output():
        print_error("Output verification failed")
        sys.exit(1)
    
    # Print summary
    print_summary(csv_path, output_dir)
    
    return 0

if __name__ == '__main__':
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print(f"\n\n{Colors.YELLOW}Process interrupted by user{Colors.END}")
        sys.exit(130)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

