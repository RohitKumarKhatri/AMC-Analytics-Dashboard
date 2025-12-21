#!/usr/bin/env python3
"""
Process CSV file and generate aggregated JSON data files for the dashboard.
This script pre-aggregates data to improve frontend performance.

Usage:
    python3 scripts/process_csv.py
"""

import csv
import json
import re
from datetime import datetime, timedelta
from collections import defaultdict
from pathlib import Path

# Month mapping
MONTHS = {
    'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
    'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
}

def parse_date(date_str):
    """Parse date string from CSV format: '21/Dec/25 8:54 AM'"""
    if not date_str or not date_str.strip():
        return None
    
    try:
        parts = date_str.strip().split(' ')
        date_part = parts[0]  # "21/Dec/25"
        day, month_str, year_str = date_part.split('/')
        year = 2000 + int(year_str)
        month = MONTHS[month_str]
        return datetime(year, month, int(day))
    except (ValueError, KeyError) as e:
        print(f"Warning: Failed to parse date '{date_str}': {e}")
        return None

def clean_customer_name(name):
    """Remove brackets [XXXX] from customer name"""
    if not name:
        return ''
    return re.sub(r'\s*\[.*?\]', '', name).strip()

def is_one_albania(customer_name):
    """Check if customer name matches One Albania (case-insensitive)"""
    if not customer_name:
        return False
    return bool(re.search(r'one\s+albania', customer_name, re.IGNORECASE))

def get_quarter(date):
    """Get quarter (1-4) from date"""
    month = date.month
    if month <= 3:
        return 1
    elif month <= 6:
        return 2
    elif month <= 9:
        return 3
    else:
        return 4

def get_week_start(date):
    """Get Monday of the week for a given date"""
    days_since_monday = date.weekday()
    return date - timedelta(days=days_since_monday)

def get_month_start(date):
    """Get first day of month"""
    return datetime(date.year, date.month, 1)

def generate_jira_link(issue_keys):
    """Generate Jira JQL link based on issue keys"""
    base_url = 'https://psskyvera.atlassian.net/issues/?jql='
    
    if not issue_keys:
        # Return empty query if no keys
        return f"{base_url}key = \"NONE\""
    
    # Format keys for JQL: key in ('KEY1', 'KEY2', ...)
    keys_str = ', '.join([f"'{key}'" for key in sorted(set(issue_keys))])
    jql = f"key in ({keys_str}) ORDER BY key DESC"
    return f"{base_url}{jql}"

def process_csv_file(csv_path):
    """Process CSV file and return structured data"""
    tickets = []
    customers = set()
    years = set()
    
    print(f"Reading CSV file: {csv_path}")
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        row_count = 0
        for row in reader:
            row_count += 1
            created_date = parse_date(row.get('Created', ''))
            closure_date = parse_date(row.get('Custom field (Closure Date)', ''))
            customer_name = row.get('Custom field (PS Customer Name)', '')
            cleaned_customer = clean_customer_name(customer_name)
            
            if not created_date:
                continue  # Skip rows without created date
            
            years.add(created_date.year)
            if cleaned_customer:
                customers.add(cleaned_customer)
            
            tickets.append({
                'created': created_date,
                'closure': closure_date,
                'customer': cleaned_customer,
                'original_customer': customer_name,
                'issue_key': row.get('Issue key', ''),
                'summary': row.get('Summary', '')
            })
    
    print(f"Processed {len(tickets)} tickets from {row_count} rows")
    print(f"Found {len(customers)} unique customers")
    print(f"Found years: {sorted(years)}")
    
    return {
        'tickets': tickets,
        'customers': sorted(customers),
        'years': sorted(years)
    }

def filter_tickets(tickets, customer_filter=None, year_filter=None):
    """Filter tickets based on criteria"""
    filtered = tickets
    
    # Filter by customer
    if customer_filter:
        if customer_filter == 'one-albania':
            filtered = [t for t in filtered if is_one_albania(t['original_customer'])]
        elif customer_filter == 'rest-of-world':
            filtered = [t for t in filtered if not is_one_albania(t['original_customer'])]
        else:
            filtered = [t for t in filtered if t['customer'] == customer_filter]
    
    # Filter by year
    if year_filter:
        filtered = [t for t in filtered if t['created'].year == year_filter]
    
    return filtered

def aggregate_weekly(tickets, customer_filter=None):
    """Aggregate tickets by week"""
    aggregated = defaultdict(lambda: {
        'created': 0,
        'resolved': 0,
        'created_keys': [],
        'resolved_keys': []
    })
    
    # First pass: count created tickets per week
    for ticket in tickets:
        created_date = ticket['created']
        week_start = get_week_start(created_date)
        week_key = week_start.strftime('%Y-%m-%d')
        week_end = week_start + timedelta(days=6)
        
        if week_key not in aggregated:
            aggregated[week_key] = {
                'week_start': week_start.strftime('%Y-%m-%d'),
                'week_end': week_end.strftime('%Y-%m-%d'),
                'label': f"{week_start.strftime('%d %b %Y')} - {week_end.strftime('%d %b %Y')}",
                'created': 0,
                'resolved': 0,
                'created_keys': [],
                'resolved_keys': []
            }
        
        # Track created ticket
        if ticket['issue_key']:
            aggregated[week_key]['created_keys'].append(ticket['issue_key'])
        aggregated[week_key]['created'] += 1
    
    # Second pass: count resolved tickets per week (regardless of when created)
    for ticket in tickets:
        if ticket['closure']:
            closure_date = ticket['closure']
            closure_week_start = get_week_start(closure_date)
            closure_week_key = closure_week_start.strftime('%Y-%m-%d')
            closure_week_end = closure_week_start + timedelta(days=6)
            
            # Initialize week if it doesn't exist (for tickets resolved but not created in this period)
            if closure_week_key not in aggregated:
                aggregated[closure_week_key] = {
                    'week_start': closure_week_start.strftime('%Y-%m-%d'),
                    'week_end': closure_week_end.strftime('%Y-%m-%d'),
                    'label': f"{closure_week_start.strftime('%d %b %Y')} - {closure_week_end.strftime('%d %b %Y')}",
                    'created': 0,
                    'resolved': 0,
                    'created_keys': [],
                    'resolved_keys': []
                }
            
            # Track resolved ticket
            if ticket['issue_key']:
                aggregated[closure_week_key]['resolved_keys'].append(ticket['issue_key'])
            aggregated[closure_week_key]['resolved'] += 1
    
    # Convert to sorted list and generate Jira links
    result = []
    for key in sorted(aggregated.keys()):
        item = aggregated[key]
        # Generate Jira links based on issue keys
        item['jira_links'] = {
            'created': generate_jira_link(item['created_keys']),
            'resolved': generate_jira_link(item['resolved_keys'])
        }
        # Remove keys from output (not needed in JSON)
        del item['created_keys']
        del item['resolved_keys']
        result.append(item)
    
    # Second pass: calculate cumulative (net change per period, starting from 0)
    cumulative = 0
    for item in result:
        net_change = item['created'] - item['resolved']
        cumulative += net_change
        item['cumulative'] = cumulative
    
    return result

def aggregate_monthly(tickets, customer_filter=None):
    """Aggregate tickets by month"""
    aggregated = defaultdict(lambda: {
        'created': 0,
        'resolved': 0,
        'created_keys': [],
        'resolved_keys': []
    })
    
    # First pass: count created tickets per month
    for ticket in tickets:
        created_date = ticket['created']
        month_start = get_month_start(created_date)
        month_key = month_start.strftime('%Y-%m')
        # Get last day of month
        if month_start.month == 12:
            month_end = datetime(month_start.year + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = datetime(month_start.year, month_start.month + 1, 1) - timedelta(days=1)
        
        if month_key not in aggregated:
            aggregated[month_key] = {
                'month': month_key,
                'month_start': month_start.strftime('%Y-%m-%d'),
                'month_end': month_end.strftime('%Y-%m-%d'),
                'label': month_start.strftime('%b %Y'),
                'created': 0,
                'resolved': 0,
                'created_keys': [],
                'resolved_keys': []
            }
        
        # Track created ticket
        if ticket['issue_key']:
            aggregated[month_key]['created_keys'].append(ticket['issue_key'])
        aggregated[month_key]['created'] += 1
    
    # Second pass: count resolved tickets per month (regardless of when created)
    for ticket in tickets:
        if ticket['closure']:
            closure_date = ticket['closure']
            closure_month_start = get_month_start(closure_date)
            closure_month_key = closure_month_start.strftime('%Y-%m')
            # Get last day of month
            if closure_month_start.month == 12:
                closure_month_end = datetime(closure_month_start.year + 1, 1, 1) - timedelta(days=1)
            else:
                closure_month_end = datetime(closure_month_start.year, closure_month_start.month + 1, 1) - timedelta(days=1)
            
            # Initialize month if it doesn't exist (for tickets resolved but not created in this period)
            if closure_month_key not in aggregated:
                aggregated[closure_month_key] = {
                    'month': closure_month_key,
                    'month_start': closure_month_start.strftime('%Y-%m-%d'),
                    'month_end': closure_month_end.strftime('%Y-%m-%d'),
                    'label': closure_month_start.strftime('%b %Y'),
                    'created': 0,
                    'resolved': 0,
                    'created_keys': [],
                    'resolved_keys': []
                }
            
            # Track resolved ticket
            if ticket['issue_key']:
                aggregated[closure_month_key]['resolved_keys'].append(ticket['issue_key'])
            aggregated[closure_month_key]['resolved'] += 1
    
    # Convert to sorted list and generate Jira links
    result = []
    for key in sorted(aggregated.keys()):
        item = aggregated[key]
        # Generate Jira links based on issue keys
        item['jira_links'] = {
            'created': generate_jira_link(item['created_keys']),
            'resolved': generate_jira_link(item['resolved_keys'])
        }
        # Remove keys from output (not needed in JSON)
        del item['created_keys']
        del item['resolved_keys']
        result.append(item)
    
    # Second pass: calculate cumulative (net change per period, starting from 0)
    cumulative = 0
    for item in result:
        net_change = item['created'] - item['resolved']
        cumulative += net_change
        item['cumulative'] = cumulative
    
    return result

def calculate_customer_ticket_counts(tickets, year, quarters):
    """Calculate ticket counts per customer for specific year and quarters"""
    customer_counts = defaultdict(int)
    
    for ticket in tickets:
        created_date = ticket['created']
        if created_date.year != year:
            continue
        
        month = created_date.month
        quarter = (month - 1) // 3 + 1
        
        if quarter in quarters:
            customer = ticket['customer']
            if customer:
                customer_counts[customer] += 1
    
    return customer_counts

def generate_all_aggregations(data, output_dir):
    """Generate all possible aggregation combinations"""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    tickets = data['tickets']
    customers = data['customers']
    years = data['years']
    
    print(f"\nGenerating aggregations for {len(years)} years and {len(customers)} customers...")
    
    # Calculate customer ticket counts for Q3 and Q4 2025 (July-December)
    customer_ticket_counts = {}
    if 2025 in years:
        q3_q4_counts = calculate_customer_ticket_counts(tickets, 2025, [3, 4])
        customer_ticket_counts = dict(q3_q4_counts)
    
    # Sort customers by ticket count (descending), then alphabetically
    def sort_key(customer):
        count = customer_ticket_counts.get(customer, 0)
        return (-count, customer.lower())  # Negative for descending order
    
    sorted_customers = sorted(customers, key=sort_key)
    
    # Generate metadata
    one_albania_customers = [c for c in sorted_customers if is_one_albania(c)]
    metadata = {
        'customers': sorted_customers,  # Use sorted list
        'years': years,
        'one_albania_customers': one_albania_customers,
        'total_tickets': len(tickets),
        'customer_ticket_counts_q3_q4_2025': customer_ticket_counts  # Store counts for reference
    }
    
    metadata_path = output_dir / 'metadata.json'
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f"Generated: metadata.json")
    
    file_count = 1
    
    # Generate aggregations for each combination
    for year in years:
        for period in ['weekly', 'monthly']:
            # All customers
            filtered = filter_tickets(tickets, year_filter=year)
            if period == 'weekly':
                aggregated = aggregate_weekly(filtered, customer_filter=None)
            else:
                aggregated = aggregate_monthly(filtered, customer_filter=None)
            
            filename = f'{period}-{year}-all.json'
            filepath = output_dir / filename
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump({
                    'period': period,
                    'year': year,
                    'customer': 'all',
                    'data': aggregated
                }, f, indent=2, ensure_ascii=False)
            file_count += 1
            
            # One Albania
            filtered = filter_tickets(tickets, customer_filter='one-albania', year_filter=year)
            if period == 'weekly':
                aggregated = aggregate_weekly(filtered, customer_filter='one-albania')
            else:
                aggregated = aggregate_monthly(filtered, customer_filter='one-albania')
            
            filename = f'{period}-{year}-one-albania.json'
            filepath = output_dir / filename
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump({
                    'period': period,
                    'year': year,
                    'customer': 'one-albania',
                    'data': aggregated
                }, f, indent=2, ensure_ascii=False)
            file_count += 1
            
            # Rest of World
            filtered = filter_tickets(tickets, customer_filter='rest-of-world', year_filter=year)
            if period == 'weekly':
                aggregated = aggregate_weekly(filtered, customer_filter='rest-of-world')
            else:
                aggregated = aggregate_monthly(filtered, customer_filter='rest-of-world')
            
            filename = f'{period}-{year}-rest-of-world.json'
            filepath = output_dir / filename
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump({
                    'period': period,
                    'year': year,
                    'customer': 'rest-of-world',
                    'data': aggregated
                }, f, indent=2, ensure_ascii=False)
            file_count += 1
            
            # Individual customers (excluding One Albania variants)
            for customer in customers:
                if not is_one_albania(customer):
                    filtered = filter_tickets(tickets, customer_filter=customer, year_filter=year)
                    if period == 'weekly':
                        aggregated = aggregate_weekly(filtered, customer_filter=customer)
                    else:
                        aggregated = aggregate_monthly(filtered, customer_filter=customer)
                    
                    # Sanitize customer name for filename
                    safe_customer = re.sub(r'[^a-zA-Z0-9_-]', '_', customer)[:50]
                    filename = f'{period}-{year}-{safe_customer}.json'
                    filepath = output_dir / filename
                    with open(filepath, 'w', encoding='utf-8') as f:
                        json.dump({
                            'period': period,
                            'year': year,
                            'customer': customer,
                            'data': aggregated
                        }, f, indent=2, ensure_ascii=False)
                    file_count += 1
    
    print(f"\nGenerated {file_count} JSON files in {output_dir}")
    return file_count

def main():
    """Main function"""
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    csv_path = project_root / 'ticket-list-export.csv'
    output_dir = project_root / 'data'
    
    if not csv_path.exists():
        print(f"Error: CSV file not found at {csv_path}")
        return 1
    
    try:
        data = process_csv_file(csv_path)
        file_count = generate_all_aggregations(data, output_dir)
        print(f"\n✅ Success! Generated {file_count} files total.")
        return 0
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    exit(main())

