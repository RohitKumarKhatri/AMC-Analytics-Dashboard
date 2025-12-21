# Jira Ticket Analytics Dashboard

A static web application for visualizing Jira ticket data with interactive charts, hosted on GitHub Pages.

## Features

- 📊 **Two Interactive Charts**:
  - Created vs Resolved tickets over time
  - Cumulative issues count over time

- 🔄 **Period Toggle**: Switch between Weekly and Monthly views (single selection)

- 📅 **Year Filter**: Dynamic buttons for each year found in data (single selection, defaults to last year)

- 📆 **Range Filter**: Q1, Q2, Q3, Q4, Annual buttons (multiple selection allowed, filters within selected year)

- 👥 **Customer Filter**: Dropdown with:
  - All PSS Customers (One Albania)
  - Rest of the World
  - Individual customers

- 🔗 **Clickable Chart Points**: Click on data points to open filtered Jira views

## Architecture

**Server-Side Aggregation Approach**:
- Python script pre-processes CSV and generates JSON files
- Frontend loads pre-aggregated JSON files based on filters
- Range filter (quarters) applied client-side on loaded data (lightweight)

## Setup

### Prerequisites

- Python 3.8 or higher
- Modern web browser

### Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Generate all aggregations (single entry point):
```bash
python3 generate_aggregations.py
```

Or make it executable and run directly:
```bash
chmod +x generate_aggregations.py
./generate_aggregations.py
```

**Note**: Simply replace `ticket-list-export.csv` with new data and run `generate_aggregations.py` again to regenerate all aggregations.

This will generate:
- `data/metadata.json` - Contains list of customers and years
- `data/{period}-{year}-{customer}.json` - Aggregated data files (~251 files total)
- `data/customer-distribution-{year}-{range}.json` - Customer distribution aggregations (~30 files)

## Usage

### Local Development

**Important**: Due to CORS restrictions, you cannot open `index.html` directly from the file system. You must use a local web server.

**Option 1: Python HTTP Server (Recommended)**
```bash
python3 -m http.server 8000
```
Then open: `http://localhost:8000` in your browser

**Option 2: Other Options**
- Use VS Code Live Server extension
- Use any other local web server

### Using the Dashboard

1. Open the dashboard in your browser (via local server)
2. The application will automatically load metadata and default to the most recent year
3. Use filters to customize the view:
   - **Period**: Weekly or Monthly
   - **Year**: Select a year button
   - **Range**: Select quarters (Q1-Q4) or Annual
   - **Customer**: Select from dropdown
4. Click on chart data points to open Jira with date filters

## File Structure

```
amc-reports/
├── ticket-list-export.csv    # Source CSV file
├── index.html                # Main HTML page
├── requirements.txt          # Python dependencies
├── scripts/
│   └── process_csv.py       # Python script to process CSV
├── data/
│   ├── metadata.json        # Metadata (customers, years)
│   └── *.json              # Aggregated data files (221 files)
├── js/
│   └── app.js              # Main application logic
├── css/
│   └── styles.css          # Styling
└── README.md               # This file
```

## Updating Data

When you have a new CSV export:

1. Replace `ticket-list-export.csv` with your new file
2. Run the processing script:
```bash
python3 scripts/process_csv.py
```
3. Commit and push the updated JSON files to GitHub
4. GitHub Pages will automatically deploy the updated site

## Dependencies

### Python Dependencies
- `pandas>=2.0.0`
- `python-dateutil>=2.8.0`

### Frontend Dependencies (CDN)
- Apache ECharts 5.x

## GitHub Pages Deployment

1. Push all files to a GitHub repository
2. Go to repository Settings → Pages
3. Select source branch (main/master)
4. Select root directory
5. Save and wait for deployment

Your site will be available at: `https://[username].github.io/[repository-name]`

## Notes

- Customer names are automatically cleaned (brackets like `[1FC8]` are removed)
- Closure Date is used instead of Resolved Date for resolved ticket counts
- All projects (SBZT + OAM) are combined
- Jira links use Closure Date custom field syntax (may need adjustment based on your Jira instance)

## Performance

- **Python Script**: ~2-4 seconds to process CSV and generate all JSON files
- **Frontend**: ~0.2-0.5 seconds to load JSON and render charts
- **Total**: Very fast, instant feel for users

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge

