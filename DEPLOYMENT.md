# AMC Analytics Dashboard - Build and Deployment Guide

This guide provides step-by-step instructions for building and deploying the AMC Analytics Dashboard to GitHub Pages.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Setup](#local-setup)
3. [Building the Dashboard](#building-the-dashboard)
4. [Deploying to GitHub Pages](#deploying-to-github-pages)
5. [Updating Data](#updating-data)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Python 3.8 or higher**
  ```bash
  python3 --version
  ```
- **Git** (for version control and deployment)
  ```bash
  git --version
  ```
- **GitHub account** with SSH access configured
- **Modern web browser** (Chrome, Firefox, Safari, or Edge)

---

## Local Setup

### 1. Clone or Navigate to the Repository

If you're working with the GitHub repository:

```bash
cd /Users/rohit/Documents/skyvera/git/AMC-Analytics-Dashboard
```

Or clone it fresh:

```bash
git clone git@github.com:RohitKumarKhatri/AMC-Analytics-Dashboard.git
cd AMC-Analytics-Dashboard
```

### 2. Install Python Dependencies

Install the required Python packages:

```bash
pip3 install -r requirements.txt
```

This will install:
- `pandas>=2.0.0`
- `python-dateutil>=2.8.0`

---

## Building the Dashboard

### Step 1: Prepare Your CSV Data

1. Export your Jira ticket data as CSV from Jira
2. Ensure the CSV file contains the following columns:
   - `Created` - Ticket creation date
   - `Custom field (Closure Date)` - Ticket resolution date
   - `Custom field (PS Customer Name)` - Customer name
   - `Issue key` - Ticket identifier (e.g., SBZT-1777)

3. Place the CSV file in the project root as `ticket-list-export.csv`

### Step 2: Generate JSON Data Files

Run the Python script to process the CSV and generate all JSON data files:

```bash
python3 scripts/process_csv.py
```

**What this does:**
- Reads `ticket-list-export.csv`
- Cleans customer names (removes brackets like `[1FC8]`)
- Aggregates data by week and month
- Generates 221 JSON files for all combinations of:
  - Periods: weekly, monthly
  - Years: 2024, 2025 (or whatever years are in your data)
  - Customers: all, one-albania, rest-of-world, and individual customers
- Creates `data/metadata.json` with customer list and years
- Sorts customers by Q3+Q4 2025 ticket count

**Expected output:**
```
Reading CSV file: /path/to/ticket-list-export.csv
Processed 1706 tickets from 1706 rows
Found 56 unique customers
Found years: [2024, 2025]

Generating aggregations for 2 years and 56 customers...
Generated: metadata.json

Generated 221 JSON files in data

✅ Success! Generated 221 files total.
```

**Processing time:** Typically 2-4 seconds

---

## Deploying to GitHub Pages

### Step 1: Verify Files Are Ready

Ensure all required files are present:

```bash
ls -la
```

You should see:
- `index.html`
- `css/` directory
- `js/` directory
- `data/` directory (with 221+ JSON files)
- `scripts/` directory
- `README.md`
- `.gitignore`

### Step 2: Commit and Push Changes

```bash
# Check status
git status

# Add all files
git add .

# Commit changes
git commit -m "Update dashboard with latest data"

# Push to GitHub
git push origin main
```

### Step 3: Enable GitHub Pages (First Time Only)

If this is your first deployment:

1. Go to your repository on GitHub: https://github.com/RohitKumarKhatri/AMC-Analytics-Dashboard
2. Click **Settings** (in the repository navigation bar)
3. Scroll down to **Pages** (in the left sidebar)
4. Under **Source**, select:
   - **Deploy from a branch**
   - **Branch:** `main`
   - **Folder:** `/ (root)`
5. Click **Save**

### Step 4: Access Your Live Site

After deployment (usually 1-2 minutes), your dashboard will be available at:

**https://rohitkumarkhatri.github.io/AMC-Analytics-Dashboard/**

You can verify deployment status:
- Go to **Actions** tab in your GitHub repository
- Look for "pages build and deployment" workflow

---

## Updating Data

When you have new ticket data:

### Step 1: Update CSV File

Replace `ticket-list-export.csv` with your new export from Jira.

### Step 2: Regenerate JSON Files

```bash
python3 scripts/process_csv.py
```

This will regenerate all 221 JSON files with the latest data.

### Step 3: Deploy Updates

```bash
git add data/
git commit -m "Update data: [describe your update]"
git push origin main
```

GitHub Pages will automatically redeploy (usually within 1-2 minutes).

---

## Project Structure

```
AMC-Analytics-Dashboard/
├── index.html              # Main HTML page
├── css/
│   └── styles.css          # Dashboard styling
├── js/
│   └── app.js              # Application logic
├── data/
│   ├── metadata.json       # Customer list and years
│   └── *.json              # 221 aggregated data files
├── scripts/
│   └── process_csv.py      # Data processing script
├── requirements.txt        # Python dependencies
├── README.md              # Project documentation
└── .gitignore             # Git ignore rules
```

---

## Key Features

### Default Settings

- **Period:** Weekly
- **Year:** Most recent year in data (defaults to 2025)
- **Range:** Q4 (defaults to Q4 instead of Annual)
- **Customer:** ONE Albania

### Customer Sorting

The customer dropdown is automatically sorted by ticket count for Q3+Q4 2025 (July-December), with highest ticket counts appearing first.

### Data Aggregation

- **Server-side:** Python script pre-processes CSV into JSON files
- **Client-side:** Browser loads pre-aggregated JSON files (fast!)
- **Range filtering:** Applied client-side for instant updates

---

## Troubleshooting

### Issue: "Failed to load metadata: 404"

**Solution:** Ensure `data/metadata.json` exists. Run `python3 scripts/process_csv.py` to generate it.

### Issue: Charts not rendering

**Solution:** 
1. Check browser console for errors (F12)
2. Ensure all JSON files are present in `data/` directory
3. Verify you're accessing via HTTP (not `file://`). Use a local server:
   ```bash
   python3 -m http.server 8000
   ```
   Then visit: `http://localhost:8000`

### Issue: Cumulative chart showing incorrect values

**Solution:** The cumulative calculation is done client-side and starts from 0 for the filtered period. Ensure data is properly sorted by date. If issues persist, check that `filterAndRenderData()` is sorting data before calculating cumulative.

### Issue: GitHub Pages not updating

**Solution:**
1. Check GitHub Actions for deployment errors
2. Verify files were committed and pushed
3. Wait 2-3 minutes for GitHub Pages to rebuild
4. Hard refresh your browser (Ctrl+F5 or Cmd+Shift+R)

### Issue: Customer dropdown empty

**Solution:** Ensure `data/metadata.json` contains the `customers` array. Regenerate it by running `python3 scripts/process_csv.py`.

---

## Local Development

### Running Locally

Due to CORS restrictions, you cannot open `index.html` directly. Use a local web server:

```bash
python3 -m http.server 8000
```

Then open: `http://localhost:8000`

### Testing Changes

1. Make changes to HTML, CSS, or JS files
2. Test locally using the HTTP server
3. Once satisfied, commit and push to GitHub

---

## Performance

- **Python Script:** ~2-4 seconds to process CSV and generate 221 JSON files
- **Frontend Load:** ~0.2-0.5 seconds to load JSON and render charts
- **Total:** Very fast, instant feel for users

---

## Support

For issues or questions:
1. Check the browser console (F12) for errors
2. Verify all files are present and properly formatted
3. Ensure Python dependencies are installed
4. Check GitHub Actions for deployment errors

---

## Quick Reference

### Common Commands

```bash
# Install dependencies
pip3 install -r requirements.txt

# Generate data files
python3 scripts/process_csv.py

# Run local server
python3 -m http.server 8000

# Deploy to GitHub
git add .
git commit -m "Your message"
git push origin main
```

### Important URLs

- **GitHub Repository:** https://github.com/RohitKumarKhatri/AMC-Analytics-Dashboard
- **Live Dashboard:** https://rohitkumarkhatri.github.io/AMC-Analytics-Dashboard/
- **GitHub Pages Settings:** https://github.com/RohitKumarKhatri/AMC-Analytics-Dashboard/settings/pages

---

**Last Updated:** December 2024

