# AMC Analytics Dashboard - Use Cases Documentation

**Purpose**: Technical documentation for AI/development reference. This document describes all use cases, user interactions, system behaviors, and technical implementation details.

**Last Updated**: 2025-01-XX

---

## Table of Contents

1. [Core Use Cases](#core-use-cases)
2. [Filter Interactions](#filter-interactions)
3. [Chart Interactions](#chart-interactions)
4. [Data Processing Use Cases](#data-processing-use-cases)
5. [Authentication & Security Use Cases](#authentication--security-use-cases)
6. [State Management Use Cases](#state-management-use-cases)
7. [Error Handling Use Cases](#error-handling-use-cases)
8. [Performance Use Cases](#performance-use-cases)

---

## Core Use Cases

### UC-001: Initial Page Load

**Description**: User navigates to the dashboard URL for the first time.

**Preconditions**:
- User has valid browser with JavaScript enabled
- GitHub Pages is accessible
- Data files exist in `data/` directory

**Flow**:
1. Browser loads `index.html`
2. ECharts library loads from CDN
3. `app.js` executes `init()` function
4. System fetches `data/metadata.json`
5. System checks localStorage for saved filters
6. System checks URL parameters for filters
7. System applies filter priority: URL params > localStorage > defaults
8. System initializes filter UI (period buttons, year buttons, range buttons, customer dropdown)
9. System sets default selections:
   - Period: `weekly`
   - Year: Most recent year from metadata
   - Range: `['Q4']`
   - Customer: `'one-albania'`
10. System calls `loadData()` with current filters
11. System constructs filename: `{period}-{year}-{customer}.json`
12. System fetches JSON data file
13. System calls `filterAndRenderData()` to apply range filter
14. System calculates cumulative values dynamically
15. System renders both charts using ECharts
16. System calls `resize()` on both charts after delay

**Postconditions**:
- Dashboard displays with default filters applied
- Charts render at full width
- All filter controls reflect current state
- Data is filtered by selected quarters

**Technical Details**:
- Default filters stored in `currentFilters` object
- Chart instances stored in `createdResolvedChart` and `cumulativeChart`
- Data stored in `currentData` variable
- Metadata stored in `metadata` variable

**Edge Cases**:
- If metadata.json fails to load → Show error message
- If data file doesn't exist → Show error message
- If no years in metadata → Use current year as default
- If localStorage is disabled → Use defaults only

---

### UC-002: View Created vs Resolved Tickets Chart

**Description**: User views the line chart showing created and resolved tickets over time.

**Preconditions**:
- Page has loaded successfully
- Data has been fetched and filtered

**Flow**:
1. System renders line chart with two series:
   - "Created" (orange line, `#ff6347`)
   - "Resolved" (green line, `#32cd32`)
2. X-axis shows time periods (weekly or monthly labels)
3. Y-axis shows ticket count (0 to max value)
4. Both left and right Y-axes display same values
5. Chart includes area fill under lines (gradient)
6. Chart points are circles (8px normal, 12px on hover)
7. Chart is responsive and resizes with window

**Chart Configuration**:
```javascript
{
  type: 'line',
  areaStyle: { gradient fill },
  symbol: 'circle',
  symbolSize: 8,
  emphasis: { symbolSize: 12 }
}
```

**Data Structure**:
```json
{
  "week_start": "2025-10-05",
  "created": 4,
  "resolved": 10,
  "jira_links": {
    "created": "https://psskyvera.atlassian.net/issues/?jql=key in ('SBZT-1777', 'SBZT-1776')",
    "resolved": "https://psskyvera.atlassian.net/issues/?jql=key in ('SBZT-1775', 'SBZT-1774')"
  }
}
```

**Postconditions**:
- Chart displays with current filter settings
- Tooltips show on hover
- Chart points are clickable

---

### UC-003: View Cumulative Issues Chart

**Description**: User views the cumulative issues chart showing net change over time.

**Preconditions**:
- Page has loaded successfully
- Data has been fetched and filtered

**Flow**:
1. System calculates cumulative values:
   - Start from 0 for filtered period
   - For each period: `cumulative = previous_cumulative + (created - resolved)`
   - Data sorted by date before calculation
2. System renders line chart with area fill
3. X-axis shows time periods
4. Y-axis shows cumulative count (can be negative)
5. Area fill is conditional:
   - `value <= 0`: Transparent (no fill)
   - `value < 5`: Light blue (10% opacity)
   - `value >= 5`: Normal blue gradient (30% opacity)
6. Chart points are circles (8px normal, 12px on hover)
7. Tooltips are disabled
8. Chart is not clickable

**Cumulative Calculation Logic**:
```javascript
let cumulative = 0;
const cumulativeData = filteredData.map(item => {
  cumulative += (item.created - item.resolved);
  return cumulative;
});
```

**Postconditions**:
- Chart displays net change over selected period
- Starts at 0 for filtered data
- Shows positive values in blue, negative/zero with no fill

---

## Filter Interactions

### UC-101: Change Period Filter (Weekly/Monthly)

**Description**: User toggles between weekly and monthly aggregation.

**User Action**: Click "Weekly" or "Monthly" button

**Flow**:
1. User clicks period button
2. System removes `active` class from all period buttons
3. System adds `active` class to clicked button
4. System updates `currentFilters.period` (`'weekly'` or `'monthly'`)
5. System saves filters to localStorage
6. System calls `loadData()`
7. System constructs new filename: `{period}-{year}-{customer}.json`
8. System fetches new data file
9. System applies range filter
10. System recalculates cumulative values
11. System re-renders both charts
12. System updates chart titles to reflect period

**Technical Details**:
- Period stored as: `'weekly'` or `'monthly'`
- Button has `data-period` attribute
- Only one button can be active at a time (single-select)

**Edge Cases**:
- If data file doesn't exist for selected period → Show error
- If switching during data load → Cancel previous request

---

### UC-102: Change Year Filter

**Description**: User selects a different year to view.

**User Action**: Click year button (e.g., "2024", "2025")

**Flow**:
1. User clicks year button
2. System removes `active` class from all year buttons
3. System adds `active` class to clicked button
4. System updates `currentFilters.year` (integer, e.g., `2025`)
5. System saves filters to localStorage
6. System calls `loadData()`
7. System constructs new filename: `{period}-{year}-{customer}.json`
8. System fetches new data file
9. System applies range filter (quarters within selected year)
10. System recalculates cumulative values
11. System re-renders both charts

**Technical Details**:
- Year stored as integer: `2024`, `2025`, etc.
- Year buttons dynamically generated from `metadata.years`
- Default: Most recent year in metadata
- Only one year can be selected at a time

**Edge Cases**:
- If year has no data → Show empty chart or error
- If switching years during load → Cancel previous request

---

### UC-103: Change Range Filter (Quarters/Annual)

**Description**: User selects one or more quarters or annual view.

**User Action**: Click range buttons (Q1, Q2, Q3, Q4, Annual)

**Flow**:
1. User clicks range button
2. If "Annual" clicked:
   - System clears all other selections
   - System sets `currentFilters.ranges = ['Annual']`
3. If quarter clicked:
   - System toggles button `active` class
   - System adds/removes quarter from `currentFilters.ranges` array
   - System removes "Annual" if it was selected
4. System validates: If no ranges selected, defaults to `['Q4']`
5. System saves filters to localStorage
6. System calls `filterAndRenderData()` (no new data fetch)
7. System filters loaded data by selected quarters:
   - Checks both `year` and `month` of each data point
   - Q1: months 1-3, Q2: months 4-6, Q3: months 7-9, Q4: months 10-12
   - Annual: all months in selected year
8. System recalculates cumulative values for filtered data
9. System re-renders both charts

**Range Filter Logic**:
```javascript
const quarterMonths = {
  'Q1': [1, 2, 3],
  'Q2': [4, 5, 6],
  'Q3': [7, 8, 9],
  'Q4': [10, 11, 12]
};

function isInRange(item, ranges, year) {
  if (ranges.includes('Annual')) return item.year === year;
  const month = new Date(item.week_start || item.month_start).getMonth() + 1;
  return ranges.some(q => quarterMonths[q].includes(month) && item.year === year);
}
```

**Technical Details**:
- Range stored as array: `['Q1']`, `['Q2', 'Q3']`, `['Annual']`, etc.
- Multiple quarters can be selected (e.g., Q1 + Q2 = first 6 months)
- Default: `['Q4']`
- Filtering happens client-side on already-loaded data

**Edge Cases**:
- If no quarters selected → Default to Q4
- If Annual + quarter selected → Annual takes precedence
- If switching years → Range filter applies to new year

---

### UC-104: Change Customer Filter

**Description**: User selects a different customer from dropdown.

**User Action**: Select customer from dropdown menu

**Flow**:
1. User selects customer from dropdown
2. System updates `currentFilters.customer`:
   - `'one-albania'`: All customers containing "one albania" (case-insensitive)
   - `'rest-of-world'`: All customers except One Albania variants
   - `'{customer_name}'`: Specific customer name
3. System saves filters to localStorage
4. System calls `loadData()`
5. System constructs new filename: `{period}-{year}-{customer}.json`
6. System fetches new data file
7. System applies range filter
8. System recalculates cumulative values
9. System re-renders both charts

**Customer Filter Options**:
- **ONE Albania**: Aggregates all customers matching `/one\s+albania/i`
- **Rest of the World**: All customers except One Albania variants
- **Individual Customers**: Each customer from metadata (sorted by ticket count)

**Technical Details**:
- Customer names cleaned: Removes `[XXXX]` patterns
- Dropdown sorted by ticket count (Q3+Q4 2025)
- Default: `'one-albania'`
- Customer name used in filename (URL-encoded if needed)

**Edge Cases**:
- If customer has no data → Show empty chart
- If customer name contains special chars → URL-encode in filename

---

## Chart Interactions

### UC-201: Click Chart Point (Created vs Resolved)

**Description**: User clicks on a data point in the Created vs Resolved chart.

**User Action**: Click on chart point (circle marker)

**Flow**:
1. User clicks on chart point
2. ECharts fires `click` event with `params` object
3. System checks `params.componentType === 'series'`
4. System gets `params.dataIndex` and `params.seriesName` ('Created' or 'Resolved')
5. System retrieves data item: `data[params.dataIndex]`
6. System gets appropriate Jira link:
   - If 'Created' → `item.jira_links.created`
   - If 'Resolved' → `item.jira_links.resolved`
7. System checks if link is valid (doesn't contain `'key = "NONE"'`)
8. System checks `skipLoginPrompt` preference:
   - If `true` → Open link directly
   - If `false` → Call `checkJiraLoginStatus(link)`
9. System prevents multiple opens with `clickHandled` flag
10. System resets flag after 300ms

**Jira Link Format**:
```
https://psskyvera.atlassian.net/issues/?jql=key in ('SBZT-1777', 'SBZT-1776', 'SBZT-1775')
```

**Technical Details**:
- Click handler attached only to Created vs Resolved chart
- Cumulative chart has no click handler
- Debounce prevents multiple tab opens
- Link opens in new tab (`_blank`)

**Edge Cases**:
- If no link available → No action
- If link contains "NONE" → No action
- If multiple rapid clicks → Only first click processed

---

### UC-202: Hover Over Chart Point

**Description**: User hovers over a chart point to see tooltip.

**User Action**: Move mouse over chart point

**Flow**:
1. User hovers over chart point
2. ECharts shows default tooltip with:
   - Series name (Created/Resolved)
   - Period label
   - Value (ticket count)
3. Chart point enlarges (8px → 12px)
4. Chart point shows emphasis style (border, shadow)

**Tooltip Content**:
- Created vs Resolved chart: Shows series name, period, value
- Cumulative chart: Disabled (no tooltip)

**Technical Details**:
- Tooltip configured in ECharts options
- Emphasis styles defined per series
- Hover effect uses CSS transitions

---

## Data Processing Use Cases

### UC-301: Process CSV File

**Description**: System processes raw CSV file to generate aggregated JSON files.

**Preconditions**:
- `ticket-list-export.csv` exists
- Python 3.8+ installed
- Required packages installed (`pandas`, `python-dateutil`)

**Flow**:
1. System reads CSV file
2. System parses date columns:
   - `Created`: Creation date
   - `Custom field (Closure Date)`: Resolution date
3. System cleans customer names:
   - Removes `[XXXX]` patterns using regex
   - Normalizes whitespace
4. System extracts unique customers and years
5. System identifies One Albania variants (case-insensitive match)
6. For each combination of (period, year, customer):
   - System filters tickets
   - System aggregates by period (weekly/monthly)
   - System counts created tickets per period
   - System counts resolved tickets per period (regardless of creation date)
   - System collects issue keys for Jira links
   - System generates Jira JQL links
7. System calculates customer ticket counts for sorting (Q3+Q4 2025)
8. System generates JSON files:
   - `{period}-{year}-{customer}.json` for each combination
   - `metadata.json` with customers, years, and sorting info

**Data Aggregation Logic**:
```python
# Created tickets: Count by creation date
# Resolved tickets: Count by resolution date (not creation date)
for ticket in tickets:
    created_period = get_period_start(ticket.created_date)
    resolved_period = get_period_start(ticket.resolved_date) if ticket.resolved_date else None
    
    if created_period:
        aggregated[created_period]['created'] += 1
        aggregated[created_period]['created_keys'].append(ticket.key)
    
    if resolved_period:
        aggregated[resolved_period]['resolved'] += 1
        aggregated[resolved_period]['resolved_keys'].append(ticket.key)
```

**Output JSON Structure**:
```json
{
  "period": "weekly",
  "year": 2025,
  "customer": "one-albania",
  "data": [
    {
      "week_start": "2025-10-05",
      "created": 4,
      "resolved": 10,
      "jira_links": {
        "created": "https://psskyvera.atlassian.net/issues/?jql=key in ('SBZT-1777', 'SBZT-1776')",
        "resolved": "https://psskyvera.atlassian.net/issues/?jql=key in ('SBZT-1775', 'SBZT-1774')"
      }
    }
  ]
}
```

**Postconditions**:
- All JSON files generated in `data/` directory
- Metadata file contains sorted customer list
- Files ready for frontend consumption

---

### UC-302: Filter Data by Range (Client-Side)

**Description**: System filters already-loaded data by selected quarters.

**Preconditions**:
- Data file has been loaded
- Range filter has been changed

**Flow**:
1. System receives loaded data array
2. System gets current filters: `currentFilters.ranges` and `currentFilters.year`
3. System filters data array:
   - For each item, extract period start date
   - Parse year and month from date
   - Check if month falls within selected quarters
   - Check if year matches selected year
4. System sorts filtered data by date
5. System calculates cumulative values:
   - Start from 0
   - For each item: `cumulative += (created - resolved)`
6. System passes filtered data to chart rendering

**Filter Logic**:
```javascript
function filterAndRenderData() {
  const filtered = currentData.data.filter(item => {
    const date = new Date(item.week_start || item.month_start);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    if (currentFilters.ranges.includes('Annual')) {
      return year === currentFilters.year;
    }
    
    return currentFilters.ranges.some(range => {
      const quarterMonths = {
        'Q1': [1, 2, 3],
        'Q2': [4, 5, 6],
        'Q3': [7, 8, 9],
        'Q4': [10, 11, 12]
      };
      return quarterMonths[range]?.includes(month) && year === currentFilters.year;
    });
  });
  
  // Sort and calculate cumulative
  filtered.sort((a, b) => new Date(a.week_start || a.month_start) - new Date(b.week_start || b.month_start));
  
  let cumulative = 0;
  const cumulativeData = filtered.map(item => {
    cumulative += (item.created - item.resolved);
    return cumulative;
  });
  
  renderCharts(filtered, cumulativeData);
}
```

**Postconditions**:
- Charts display only data for selected quarters
- Cumulative chart starts at 0 for filtered period
- X-axis labels show only filtered periods

---

## Authentication & Security Use Cases

### UC-401: Check Jira Login Status

**Description**: System checks if user is logged into Jira before opening links.

**Preconditions**:
- User clicked on chart point
- Jira link is available
- User has not selected "Don't show again"

**Flow**:
1. System checks cached login status:
   - Reads `amc-dashboard-jira-logged-in` from localStorage
   - Reads `amc-dashboard-jira-login-check-time`
   - If cache exists and < 5 minutes old:
     - If `'true'` → Open link directly
     - If `'false'` → Show login modal
2. If no cache or expired:
   - System attempts fetch: `https://psskyvera.atlassian.net/rest/api/2/myself`
   - Uses `credentials: 'include'` to send cookies
   - Sets timeout: 2 seconds
   - If response OK (200) → User logged in:
     - Cache status as `'true'`
     - Open link directly
   - If response fails or CORS error → User not logged in:
     - Cache status as `'false'`
     - Show login modal

**Login Check API**:
```javascript
async function checkJiraLoginStatus(jiraLink) {
  // Check cache first
  const cached = localStorage.getItem('amc-dashboard-jira-logged-in');
  const cacheTime = localStorage.getItem('amc-dashboard-jira-login-check-time');
  if (cached && Date.now() - parseInt(cacheTime) < 5 * 60 * 1000) {
    if (cached === 'true') {
      window.open(jiraLink, '_blank');
      return;
    }
  }
  
  // Try API check
  try {
    const response = await fetch('https://psskyvera.atlassian.net/rest/api/2/myself', {
      credentials: 'include',
      signal: AbortSignal.timeout(2000)
    });
    
    if (response.ok) {
      localStorage.setItem('amc-dashboard-jira-logged-in', 'true');
      localStorage.setItem('amc-dashboard-jira-login-check-time', Date.now().toString());
      window.open(jiraLink, '_blank');
    } else {
      showLoginModal();
    }
  } catch (error) {
    // CORS or network error - show modal to be safe
    showLoginModal();
  }
}
```

**Postconditions**:
- If logged in → Link opens directly
- If not logged in → Login modal appears
- Status cached for 5 minutes

**Edge Cases**:
- CORS error → Assume not logged in, show modal
- Network timeout → Assume not logged in, show modal
- Cache expired → Re-check login status

---

### UC-402: Show Login Modal

**Description**: System displays modal prompting user to login to Jira.

**Preconditions**:
- User clicked chart point
- System determined user is not logged in (or unknown)

**Flow**:
1. System sets `pendingJiraLink` to the Jira link
2. System displays modal with:
   - Title: "Login Required"
   - Message: "To view Jira tickets, you need to be logged into your Atlassian account."
   - "Login to Jira" button (links to login page)
   - "Proceed to Jira Query" button
   - "Don't show this message again" checkbox
3. User can:
   - Click "Login to Jira" → Opens login page, caches login status after 3s
   - Click "Proceed" → Opens link, caches login status as 'true'
   - Check "Don't show again" → Saves preference, future clicks skip check
   - Click X or outside → Closes modal, cancels action
   - Press Escape → Closes modal

**Modal Actions**:
- **Login Button**: Opens `https://psskyvera.atlassian.net/login` in new tab, caches login status after 3 seconds
- **Proceed Button**: Opens `pendingJiraLink`, caches login status as 'true', closes modal
- **Don't Show Again**: Sets `amc-dashboard-skip-login-prompt = 'true'` in localStorage

**Postconditions**:
- Modal displayed
- User can choose to login or proceed
- Preference saved if checkbox checked

---

## State Management Use Cases

### UC-501: Save Filter State to localStorage

**Description**: System saves current filter selections to browser localStorage.

**Trigger**: Any filter change (period, year, range, customer)

**Flow**:
1. User changes filter
2. System updates `currentFilters` object
3. System calls `saveFiltersToStorage()`
4. System serializes `currentFilters` to JSON
5. System saves to localStorage key: `'amc-dashboard-filters'`
6. System handles errors gracefully (if localStorage disabled)

**Stored Data Structure**:
```json
{
  "period": "weekly",
  "year": 2025,
  "ranges": ["Q4"],
  "customer": "one-albania"
}
```

**Technical Details**:
- Saved on every filter change
- Used on page load to restore state
- Falls back to defaults if localStorage unavailable

---

### UC-502: Load Filter State from localStorage

**Description**: System restores filter selections from previous session.

**Trigger**: Page load (`init()` function)

**Flow**:
1. System calls `getUrlParams()`
2. System checks URL parameters first (highest priority)
3. If no URL params, system calls `loadFiltersFromStorage()`
4. System reads `'amc-dashboard-filters'` from localStorage
5. System parses JSON
6. System validates and merges with defaults
7. System applies filters to UI
8. System loads data with restored filters

**Priority Order**:
1. URL parameters (if present)
2. localStorage (if available)
3. Default values

**Postconditions**:
- Filters restored to last used state
- Charts display with restored filters
- UI reflects restored state

---

### UC-503: Update URL Parameters

**Description**: System updates browser URL with current filter state (for sharing).

**Note**: Currently implemented but not actively used. Could be enabled for shareable links.

**Flow**:
1. System calls `buildUrl()` function
2. System creates URLSearchParams object
3. System adds each filter as query parameter:
   - `period=weekly`
   - `year=2025`
   - `ranges=Q4` or `ranges=Q1,Q2`
   - `customer=one-albania`
4. System constructs full URL with query string
5. System could update `window.location` (currently not implemented)

**URL Format**:
```
https://rohitkumarkhatri.github.io/AMC-Analytics-Dashboard/?period=weekly&year=2025&ranges=Q4&customer=one-albania
```

---

## Error Handling Use Cases

### UC-601: Handle Metadata Load Failure

**Description**: System handles failure to load metadata.json.

**Preconditions**:
- Page loads
- System attempts to fetch `data/metadata.json`

**Flow**:
1. System calls `fetch('data/metadata.json')`
2. If response not OK:
   - System calls `showError()`
   - System displays error message: "Error loading data. Please check the console for details."
   - System logs error to console
   - Charts do not render

**Error Display**:
- Error div shown
- Loading spinner hidden
- Charts container hidden

**Recovery**:
- User must refresh page
- System will retry on refresh

---

### UC-602: Handle Data File Load Failure

**Description**: System handles failure to load specific data JSON file.

**Preconditions**:
- Metadata loaded successfully
- User selects filters
- System attempts to fetch data file

**Flow**:
1. System constructs filename: `{period}-{year}-{customer}.json`
2. System calls `fetch(filename)`
3. If response not OK:
   - System calls `showError()`
   - System displays error message
   - System logs error to console
   - Previous charts remain visible (if any)

**Error Handling**:
- Graceful degradation
- Error message displayed
- User can try different filters

---

### UC-603: Handle localStorage Unavailable

**Description**: System handles case where localStorage is disabled or unavailable.

**Preconditions**:
- Browser has localStorage disabled
- System attempts to save/load filters

**Flow**:
1. System wraps localStorage calls in try-catch
2. If error occurs:
   - System logs warning to console
   - System continues with defaults
   - No filter state saved/restored

**Fallback Behavior**:
- Uses default filters
- No state persistence
- All other functionality works normally

---

## Performance Use Cases

### UC-701: Lazy Load Chart Data

**Description**: System loads data only when needed based on filters.

**Flow**:
1. System loads metadata first (small file)
2. System initializes UI with defaults
3. System loads data file only for selected filters
4. System does not load all data files upfront
5. System loads new file only when filters change

**Benefits**:
- Faster initial page load
- Reduced bandwidth usage
- Better user experience

---

### UC-702: Client-Side Range Filtering

**Description**: System filters data client-side for range (quarters) to avoid extra requests.

**Flow**:
1. System loads full year data file
2. System applies range filter in JavaScript
3. System recalculates cumulative values
4. System re-renders charts
5. No new data fetch required

**Benefits**:
- Instant filter response
- Reduced server requests
- Smooth user experience

---

### UC-703: Chart Resize Optimization

**Description**: System ensures charts render at full width and resize correctly.

**Flow**:
1. System calls `chart.resize()` after:
   - Initial render (400ms delay)
   - Data load (150ms delay)
   - Filter change (150ms delay)
   - Window resize event
2. System uses `setTimeout` to ensure DOM is ready
3. System calls resize multiple times for reliability

**Resize Triggers**:
- Window resize event listener
- After chart initialization
- After data loading
- After filter changes

---

## Data Flow Diagrams

### Overall Data Flow

```
CSV File (ticket-list-export.csv)
    ↓
Python Script (process_csv.py)
    ↓
JSON Files (data/{period}-{year}-{customer}.json)
    ↓
Frontend Fetch (loadData())
    ↓
Client-Side Filtering (filterAndRenderData())
    ↓
Chart Rendering (renderCharts())
    ↓
User Interaction (click, hover, filter changes)
```

### Filter Change Flow

```
User Clicks Filter
    ↓
Update currentFilters Object
    ↓
Save to localStorage
    ↓
Load New Data File (if period/year/customer changed)
    OR
Filter Existing Data (if range changed)
    ↓
Recalculate Cumulative Values
    ↓
Re-render Charts
    ↓
Resize Charts
```

### Login Check Flow

```
User Clicks Chart Point
    ↓
Check "Don't Show Again" Preference
    ↓ (if false)
Check Cached Login Status (< 5 min old)
    ↓ (if no cache)
Fetch Jira API (/rest/api/2/myself)
    ↓
Success → Open Link Directly
Failure → Show Login Modal
    ↓
User Clicks "Proceed" or "Login"
    ↓
Cache Login Status
    ↓
Open Jira Link
```

---

## Technical Constants

### Default Values
- **Period**: `'weekly'`
- **Year**: Most recent year in metadata
- **Range**: `['Q4']`
- **Customer**: `'one-albania'`

### localStorage Keys
- `'amc-dashboard-filters'`: Filter state
- `'amc-dashboard-jira-logged-in'`: Login status ('true'/'false')
- `'amc-dashboard-jira-login-check-time'`: Timestamp of last login check
- `'amc-dashboard-skip-login-prompt'`: Skip login check preference ('true')

### Cache Durations
- **Filter State**: Indefinite (until cleared)
- **Login Status**: 5 minutes
- **Skip Login Prompt**: Indefinite (until unchecked)

### API Endpoints
- **Metadata**: `data/metadata.json`
- **Data Files**: `data/{period}-{year}-{customer}.json`
- **Jira Login Check**: `https://psskyvera.atlassian.net/rest/api/2/myself`
- **Jira Login Page**: `https://psskyvera.atlassian.net/login`

### Chart Configuration
- **Created Color**: `#ff6347` (tomato)
- **Resolved Color**: `#32cd32` (lime green)
- **Cumulative Color**: `#4169e1` (royal blue)
- **Symbol Size**: 8px (normal), 12px (hover)
- **Chart Height**: 400px

---

## Edge Cases Summary

1. **No Data Available**: Show empty chart or error message
2. **Invalid Date Formats**: Handle gracefully, skip invalid entries
3. **Missing Customer Names**: Treat as empty string, group separately
4. **CORS Errors**: Show login modal as fallback
5. **Network Timeouts**: Show error message, allow retry
6. **localStorage Disabled**: Use defaults, continue without persistence
7. **Multiple Rapid Clicks**: Debounce to prevent multiple actions
8. **Window Resize During Load**: Queue resize calls, execute after load
9. **Invalid Filter Combinations**: Validate and use defaults
10. **Expired Cache**: Re-check login status or reload data

---

## Testing Scenarios

### Scenario 1: New User First Visit
1. User opens dashboard
2. Default filters applied
3. Default data loaded
4. Charts render correctly

### Scenario 2: Returning User
1. User opens dashboard
2. Filters restored from localStorage
3. Data loaded with restored filters
4. Charts reflect previous state

### Scenario 3: Filter Change Sequence
1. User changes period (weekly → monthly)
2. User changes year (2024 → 2025)
3. User changes range (Q4 → Q1, Q2)
4. User changes customer (ONE Albania → Rest of World)
5. Each change triggers appropriate data load/filter
6. Charts update correctly

### Scenario 4: Chart Interaction
1. User hovers over chart point → Tooltip shows
2. User clicks chart point → Login check → Link opens
3. User clicks cumulative chart → No action (not clickable)

### Scenario 5: Login Flow
1. User not logged in → Clicks chart point → Modal appears
2. User clicks "Login to Jira" → Login page opens
3. User logs in → Returns to dashboard
4. User clicks chart point again → Link opens directly (cached)

---

## JSON Schema Examples

### Metadata JSON
```json
{
  "customers": [
    "STL - One Albania",
    "STL - Airtel Fixedline",
    "Rest of the World"
  ],
  "years": [2024, 2025],
  "one_albania_customers": [
    "ONE Albania",
    "STL - One Albania Internal"
  ],
  "total_tickets": 1706
}
```

### Data JSON
```json
{
  "period": "weekly",
  "year": 2025,
  "customer": "one-albania",
  "data": [
    {
      "week_start": "2025-10-05",
      "created": 4,
      "resolved": 10,
      "jira_links": {
        "created": "https://psskyvera.atlassian.net/issues/?jql=key in ('SBZT-1777', 'SBZT-1776')",
        "resolved": "https://psskyvera.atlassian.net/issues/?jql=key in ('SBZT-1775', 'SBZT-1774')"
      }
    }
  ]
}
```

---

**End of Document**

