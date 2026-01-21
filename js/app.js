// Main application logic - loads pre-aggregated JSON files

// List of all Jira projects
const JIRA_PROJECTS = [
    'AS', 'ASA', 'ASAB', 'ASAC', 'ASAI', 'ASAL', 'ASAM', 'ASD', 'ASGT', 'ASU', 'ASVH',
    'ATW', 'AVMVCC', 'MSAFL', 'MSBB', 'MSBG', 'MSS', 'OAM', 'OASDAIS', 'PUWUS', 'SBZT'
];

// Generate project list for JQL query
const JIRA_PROJECTS_JQL = JIRA_PROJECTS.join(', ');

// Cache-busting helper function (5-minute cache)
function getCacheBustingUrl(url) {
    const cacheDuration = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    const cacheKey = Math.floor(now / cacheDuration);
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}_cb=${cacheKey}`;
}

// Store scroll position to prevent jumping
let scrollPosition = 0;

// Prevent scroll to top on filter clicks
window.addEventListener('scroll', () => {
    scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
});

let metadata = null;
let currentData = null;
let currentFilters = {
    period: 'monthly',
    year: null,
    ranges: ['Annual'],
    customer: 'all'
};
// Removed: pendingJiraLink - no longer needed
let customerPieChart = null;
let customerFilters = {
    period: 'weekly',
    year: null,
    ranges: ['Annual']
};
let teamPerformanceData = null;
let teamFilters = {
    year: null,
    range: 'Q4'
};

// Save filters to localStorage
function saveFiltersToStorage() {
    try {
        localStorage.setItem('amc-dashboard-filters', JSON.stringify(currentFilters));
    } catch (e) {
        console.warn('Could not save filters to localStorage:', e);
    }
}

// Load filters from localStorage
function loadFiltersFromStorage() {
    try {
        const saved = localStorage.getItem('amc-dashboard-filters');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Validate and merge with defaults
            return {
                period: parsed.period || 'monthly',
                year: parsed.year || null,
                ranges: Array.isArray(parsed.ranges) && parsed.ranges.length > 0 ? parsed.ranges : ['Annual'],
                customer: parsed.customer || 'all'
            };
        }
    } catch (e) {
        console.warn('Could not load filters from localStorage:', e);
    }
    return null;
}

// Get URL parameters or saved filters
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    
    // Check if URL has parameters (takes precedence)
    if (params.toString()) {
        return {
            period: params.get('period') || 'monthly',
            year: params.get('year') ? parseInt(params.get('year')) : null,
            ranges: params.get('ranges') ? params.get('ranges').split(',') : ['Annual'],
            customer: params.get('customer') || 'all'
        };
    }
    
    // Otherwise, try to load from localStorage
    const saved = loadFiltersFromStorage();
    if (saved) {
        return saved;
    }
    
    // Default values
    return {
        period: 'monthly',
        year: null,
        ranges: ['Annual'],
        customer: 'all'
    };
}

// Build URL with current filters
function buildUrl() {
    const params = new URLSearchParams();
    params.set('period', currentFilters.period);
    if (currentFilters.year) {
        params.set('year', currentFilters.year.toString());
    }
    params.set('ranges', currentFilters.ranges.join(','));
    params.set('customer', currentFilters.customer);
    return window.location.pathname + '?' + params.toString();
}

// Initialize application
async function init() {
    try {
        showLoading();
        
        // Load metadata with cache-busting
        const metadataResponse = await fetch(getCacheBustingUrl('data/metadata.json'));
        if (!metadataResponse.ok) {
            throw new Error(`Failed to load metadata: ${metadataResponse.status}`);
        }
        metadata = await metadataResponse.json();
        
        // Load filters from URL or use defaults
        const urlParams = getUrlParams();
        currentFilters.period = urlParams.period;
        currentFilters.year = urlParams.year || (metadata.years && metadata.years.length > 0 ? metadata.years[metadata.years.length - 1] : null);
        currentFilters.ranges = urlParams.ranges;
        currentFilters.customer = urlParams.customer;
        
        // Initialize UI
        initFilters();
        initCharts();
        
        // Set default filters
        if (metadata.years && metadata.years.length > 0 && !currentFilters.year) {
            currentFilters.year = metadata.years[metadata.years.length - 1]; // Last year
        }
        updateYearButtons();
        updateRangeButtons();
        
        // Set period button active state based on currentFilters
        document.querySelectorAll('#period-buttons .btn-toggle').forEach(btn => {
            if (btn.dataset.period === currentFilters.period) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Set default customer dropdown selection
        const customerSelect = document.getElementById('customer-filter');
        if (customerSelect) {
            customerSelect.value = currentFilters.customer;
        }
        
        // Load initial data
        await loadData();
        
        hideLoading();
        
        // Force resize charts after everything is loaded and visible
        // Use requestAnimationFrame to ensure DOM is fully rendered
        requestAnimationFrame(() => {
            setTimeout(() => {
                if (createdResolvedChart) {
                    createdResolvedChart.resize();
                }
                if (cumulativeChart) {
                    cumulativeChart.resize();
                }
                // Additional resize calls to ensure full width rendering
                setTimeout(() => {
                    if (createdResolvedChart) createdResolvedChart.resize();
                    if (cumulativeChart) cumulativeChart.resize();
                }, 200);
                setTimeout(() => {
                    if (createdResolvedChart) createdResolvedChart.resize();
                    if (cumulativeChart) cumulativeChart.resize();
                }, 500);
            }, 100);
        });
    } catch (error) {
        console.error('Error initializing application:', error);
        showError();
    }
}

// Initialize filter UI
function initFilters() {
    if (!metadata || !metadata.customers) {
        console.error('Metadata not loaded');
        return;
    }
    
    // Populate customer dropdown
    const customerSelect = document.getElementById('customer-filter');
    
    // Add special options
    const oneAlbaniaOption = document.createElement('option');
    oneAlbaniaOption.value = 'one-albania';
    oneAlbaniaOption.textContent = 'ONE Albania';
    customerSelect.appendChild(oneAlbaniaOption);
    
    const restOfWorldOption = document.createElement('option');
    restOfWorldOption.value = 'rest-of-world';
    restOfWorldOption.textContent = 'Rest of the World';
    customerSelect.appendChild(restOfWorldOption);
    
    // Add individual customers (excluding One Albania variants)
    metadata.customers.forEach(customer => {
        const isOneAlbania = /one\s+albania/i.test(customer);
        if (!isOneAlbania) {
            const option = document.createElement('option');
            option.value = customer;
            option.textContent = customer;
            customerSelect.appendChild(option);
        }
    });
    
    // Set up event listeners
    setupEventListeners();
}

// Update year buttons dynamically
function updateYearButtons() {
    if (!metadata || !metadata.years) {
        return;
    }
    
    const yearButtonsContainer = document.getElementById('year-buttons');
    yearButtonsContainer.innerHTML = '';
    
    metadata.years.forEach(year => {
        const button = document.createElement('button');
        button.type = 'button'; // Prevent form submission
        button.className = 'btn-toggle';
        button.textContent = year;
        button.dataset.year = year;
        if (currentFilters.year === year) {
            button.classList.add('active');
        }
        yearButtonsContainer.appendChild(button);
    });
    
    // Re-attach event listeners
    setupYearButtonListeners();
}

// Setup event listeners
function setupEventListeners() {
    // Period buttons
    document.querySelectorAll('#period-buttons .btn-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            btn.blur(); // Remove focus to prevent scroll
            const savedScroll = window.pageYOffset || document.documentElement.scrollTop;
            document.querySelectorAll('#period-buttons .btn-toggle').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilters.period = btn.dataset.period;
            saveFiltersToStorage();
            loadData();
            // Restore scroll position after a brief delay
            requestAnimationFrame(() => {
                window.scrollTo(0, savedScroll);
            });
        });
    });
    
    // Customer dropdown
    document.getElementById('customer-filter').addEventListener('change', (e) => {
        currentFilters.customer = e.target.value;
        saveFiltersToStorage();
        loadData();
    });
    
    // Range buttons
    setupRangeButtonListeners();
}

// Setup year button listeners
function setupYearButtonListeners() {
    document.querySelectorAll('#year-buttons .btn-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            btn.blur(); // Remove focus to prevent scroll
            const savedScroll = window.pageYOffset || document.documentElement.scrollTop;
            document.querySelectorAll('#year-buttons .btn-toggle').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilters.year = parseInt(btn.dataset.year);
            saveFiltersToStorage();
            loadData();
            // Restore scroll position after a brief delay
            requestAnimationFrame(() => {
                window.scrollTo(0, savedScroll);
            });
        });
    });
}

// Setup range button listeners
function setupRangeButtonListeners() {
    document.querySelectorAll('#range-buttons .btn-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            btn.blur(); // Remove focus to prevent scroll
            e.stopImmediatePropagation();
            const savedScroll = window.pageYOffset || document.documentElement.scrollTop;
            const range = btn.dataset.range;

            // RADIO behavior: only one active at a time
            document.querySelectorAll('#range-buttons .btn-toggle').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilters.ranges = [range];

            // Save filters to localStorage
            saveFiltersToStorage();
            
            // Recalculate and render with smooth transition
            filterAndRenderData();
            // Restore scroll position after a brief delay
            requestAnimationFrame(() => {
                window.scrollTo(0, savedScroll);
            });
        });
    });
}

// Update range buttons state
function updateRangeButtons() {
    const rangeButtons = document.querySelectorAll('#range-buttons .btn-toggle');
    rangeButtons.forEach(btn => {
        const range = btn.dataset.range;
        if (currentFilters.ranges.includes(range)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Load data file based on current filters
async function loadData() {
    try {
        showLoading();
        
        const filename = getDataFilename();
        console.log('[DEBUG] Loading file:', filename);
        console.log('[DEBUG] Current filters:', JSON.stringify(currentFilters));
        const url = getCacheBustingUrl(`data/${filename}`);
        console.log('[DEBUG] Fetching URL:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error(`[DEBUG] HTTP Error: ${response.status} ${response.statusText}`);
            throw new Error(`Failed to load ${filename}: ${response.status}`);
        }
        
        const fileData = await response.json();
        console.log('[DEBUG] Loaded data:', fileData);
        console.log('[DEBUG] Data array length:', fileData.data ? fileData.data.length : 0);
        console.log('[DEBUG] Total created in file:', fileData.data ? fileData.data.reduce((sum, item) => sum + (item.created || 0), 0) : 0);
        
        if (!fileData.data || fileData.data.length === 0) {
            console.warn('[DEBUG] Warning: File loaded but contains no data items - clearing display');
            // Clear current data and charts immediately
            currentData = [];
            updateStatsCards(0, 0);
            if (createdResolvedChart) {
                createdResolvedChart.clear();
            }
            if (cumulativeChart) {
                cumulativeChart.clear();
            }
            hideLoading();
            return; // Exit early - don't call filterAndRenderData
        }
        
        currentData = fileData.data;
        console.log('[DEBUG] currentData set, length:', currentData ? currentData.length : 0);
        
        filterAndRenderData();
        hideLoading();
        
        // Force resize charts after data loads and container is visible
        // Use multiple resize calls to ensure charts render at full width
        requestAnimationFrame(() => {
            setTimeout(() => {
                if (createdResolvedChart) {
                    createdResolvedChart.resize();
                }
                if (cumulativeChart) {
                    cumulativeChart.resize();
                }
                // Additional resize after a longer delay to catch any layout shifts
                setTimeout(() => {
                    if (createdResolvedChart) createdResolvedChart.resize();
                    if (cumulativeChart) cumulativeChart.resize();
                }, 200);
            }, 100);
        });
    } catch (error) {
        console.error('Error loading data:', error);
        console.error('[DEBUG] Failed to load file:', filename);
        console.error('[DEBUG] Current filters:', currentFilters);
        showError();
    }
}

// Get filename based on current filters
function getDataFilename() {
    const period = currentFilters.period;
    const year = currentFilters.year;
    let customer = currentFilters.customer;
    
    // Map customer filter to filename
    if (customer === 'all') {
        customer = 'all';
    } else if (customer === 'one-albania') {
        customer = 'one-albania';
    } else if (customer === 'rest-of-world') {
        customer = 'rest-of-world';
    } else {
        // Sanitize customer name for filename
        customer = customer.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
    }
    
    return `${period}-${year}-${customer}.json`;
}

// Filter data by range (quarters) and render
function filterAndRenderData() {
    console.log('[DEBUG] filterAndRenderData called');
    console.log('[DEBUG] currentData:', currentData);
    console.log('[DEBUG] currentData length:', currentData ? currentData.length : 0);
    
    if (!currentData || currentData.length === 0) {
        console.warn('[DEBUG] No data to render - clearing charts and stats');
        // Clear charts and stats when no data
        updateStatsCards(0, 0);
        if (createdResolvedChart) {
            createdResolvedChart.clear();
        }
        if (cumulativeChart) {
            cumulativeChart.clear();
        }
        return;
    }
    
    let filtered = currentData;
    
    // Always filter by year first (regardless of range selection)
    // Also filter out future dates
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for comparison
    
    if (currentFilters.year) {
        filtered = currentData.filter(item => {
            // Extract year from date string (YYYY-MM-DD or YYYY-MM)
            const dateStr = item.week_start || item.month_start || item.month;
            if (!dateStr) return false;
            
            // For weekly data, check if week overlaps with target year (not just week start year)
            if (item.week_start) {
                const weekStartParts = dateStr.split('-');
                const weekStartYear = parseInt(weekStartParts[0]);
                
                // Also check week_end to see if week overlaps with target year
                const weekEndStr = item.week_end;
                if (weekEndStr) {
                    const weekEndParts = weekEndStr.split('-');
                    const weekEndYear = parseInt(weekEndParts[0]);
                    
                    // Include week if it overlaps with target year (starts in year OR ends in year)
                    if (weekStartYear !== currentFilters.year && weekEndYear !== currentFilters.year) {
                        return false;
                    }
                } else {
                    // Fallback: only check week start year
                    if (weekStartYear !== currentFilters.year) {
                        return false;
                    }
                }
            } else {
                // For monthly data, check month start year
                const parts = dateStr.split('-');
                const year = parseInt(parts[0]);
                
                // Only include if year matches selected year
                if (year !== currentFilters.year) {
                    return false;
                }
            }
            
            // Filter out future dates
            // For weekly: use week_start, for monthly: use month_start or month
            let itemDate;
            if (item.week_start) {
                itemDate = new Date(item.week_start);
            } else if (item.month_start) {
                itemDate = new Date(item.month_start);
            } else if (item.month) {
                // Parse YYYY-MM format
                const [y, m] = item.month.split('-').map(Number);
                itemDate = new Date(y, m - 1, 1);
            } else {
                return false;
            }
            
            // Only include if date is today or in the past
            return itemDate <= today;
        });
    } else {
        // Even without year filter, filter out future dates
        filtered = currentData.filter(item => {
            const dateStr = item.week_start || item.month_start || item.month;
            if (!dateStr) return false;
            
            let itemDate;
            if (item.week_start) {
                itemDate = new Date(item.week_start);
            } else if (item.month_start) {
                itemDate = new Date(item.month_start);
            } else if (item.month) {
                const [y, m] = item.month.split('-').map(Number);
                itemDate = new Date(y, m - 1, 1);
            } else {
                return false;
            }
            
            return itemDate <= today;
        });
    }
    
    // Filter by range (quarters) - only if not Annual
    if (currentFilters.ranges.length > 0 && !currentFilters.ranges.includes('Annual')) {
        const selectedQuarters = new Set();
        currentFilters.ranges.forEach(range => {
            const q = parseInt(range.replace('Q', ''));
            if (q >= 1 && q <= 4) {
                selectedQuarters.add(q);
            }
        });
        
        if (selectedQuarters.size > 0) {
            filtered = filtered.filter(item => {
                // Extract month from date string (YYYY-MM-DD or YYYY-MM)
                const dateStr = item.week_start || item.month_start || item.month;
                if (!dateStr) return false;
                
                const parts = dateStr.split('-');
                const year = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                
                // CRITICAL: Only include if year matches selected year
                // This prevents December 2025 from matching Q4 2026 filter
                if (currentFilters.year && year !== currentFilters.year) {
                    // For weekly data spanning year boundaries, check week_end
                    if (item.week_end) {
                        const weekEndParts = item.week_end.split('-');
                        const weekEndYear = parseInt(weekEndParts[0]);
                        const weekEndMonth = parseInt(weekEndParts[1]);
                        
                        // If week_end is in the selected year, use that month for quarter calculation
                        if (weekEndYear === currentFilters.year) {
                            const quarter = Math.ceil(weekEndMonth / 3);
                            return selectedQuarters.has(quarter);
                        }
                    }
                    return false;
                }
                
                // Filter by quarter (only if year matches)
                const quarter = Math.ceil(month / 3);
                return selectedQuarters.has(quarter);
            });
        }
    }
    
    // Sort filtered data by date to ensure correct order
    filtered.sort((a, b) => {
        const dateA = a.week_start || a.month_start || a.month || '';
        const dateB = b.week_start || b.month_start || b.month || '';
        return dateA.localeCompare(dateB);
    });
    
    // Calculate cumulative dynamically (browser-side)
    // Cumulative = running sum of (created - resolved), starting from 0
    let cumulative = 0;
    let totalCreated = 0;
    let totalResolved = 0;
    
    console.log('[DEBUG] filterAndRenderData - filtered length:', filtered.length);
    console.log('[DEBUG] filterAndRenderData - filtered items:', filtered);
    
    const dataWithCumulative = filtered.map(item => {
        const netChange = item.created - item.resolved;
        cumulative += netChange;
        totalCreated += item.created || 0;
        totalResolved += item.resolved || 0;
        console.log('[DEBUG] Processing item:', item.label, 'created:', item.created, 'resolved:', item.resolved);
        return {
            ...item,
            cumulative: cumulative
        };
    });
    
    console.log('[DEBUG] Total calculated - created:', totalCreated, 'resolved:', totalResolved);
    
    // Update stat cards with totals
    updateStatsCards(totalCreated, totalResolved);
    
    // Smooth transition: fade out, update, fade in
    if (createdResolvedChart && cumulativeChart) {
        // Fade out charts
        const chartsContainer = document.getElementById('charts-container');
        chartsContainer.style.opacity = '0';
        chartsContainer.style.transition = 'opacity 0.2s ease-out';
        
        setTimeout(() => {
            renderCharts(dataWithCumulative);
            
            // Fade in charts
            setTimeout(() => {
                chartsContainer.style.opacity = '1';
                chartsContainer.style.transition = 'opacity 0.3s ease-in';
            }, 50);
        }, 200);
    } else {
        renderCharts(dataWithCumulative);
    }
}

// Initialize charts
function initCharts() {
    const createdResolvedEl = document.getElementById('created-resolved-chart');
    const cumulativeEl = document.getElementById('cumulative-chart');
    
    if (!createdResolvedEl || !cumulativeEl) {
        console.error('Chart containers not found');
        return;
    }
    
    // Ensure containers have explicit width
    createdResolvedEl.style.width = '100%';
    cumulativeEl.style.width = '100%';
    
    // Initialize charts immediately but ensure proper sizing
    createdResolvedChart = echarts.init(createdResolvedEl);
    cumulativeChart = echarts.init(cumulativeEl);
    
    // Handle window resize
    const resizeHandler = () => {
        if (createdResolvedChart) createdResolvedChart.resize();
        if (cumulativeChart) cumulativeChart.resize();
    };
    window.addEventListener('resize', resizeHandler);
    
    // Force initial resize after container is ready and visible
    // Use requestAnimationFrame to ensure DOM is painted
    requestAnimationFrame(() => {
        setTimeout(() => {
            resizeHandler();
            // Additional resize after a longer delay to catch layout shifts
            setTimeout(() => {
                resizeHandler();
            }, 300);
        }, 100);
    });
}

// Update stat cards with totals
function updateStatsCards(created, resolved) {
    const createdEl = document.getElementById('stat-created-value');
    const resolvedEl = document.getElementById('stat-resolved-value');
    const netEl = document.getElementById('stat-net-value');
    
    if (createdEl) {
        createdEl.textContent = created || 0;
    }
    if (resolvedEl) {
        resolvedEl.textContent = resolved || 0;
    }
    if (netEl) {
        const net = (created || 0) - (resolved || 0);
        netEl.textContent = net;
        // Update color based on positive/negative
        if (netEl.parentElement) {
            if (net > 0) {
                netEl.parentElement.style.borderColor = '#ff6347';
                netEl.style.color = '#ff6347';
            } else if (net < 0) {
                netEl.parentElement.style.borderColor = '#32cd32';
                netEl.style.color = '#32cd32';
            } else {
                netEl.parentElement.style.borderColor = '#667eea';
                netEl.style.color = '#667eea';
            }
        }
    }
}

// Render charts
function renderCharts(data) {
    if (!data || data.length === 0) {
        console.warn('No data to render');
        return;
    }
    
    const labels = data.map(d => d.label);
    const created = data.map(d => d.created);
    const resolved = data.map(d => d.resolved);
    const cumulative = data.map(d => d.cumulative);
    
    // Created vs Resolved Chart
    const createdResolvedOption = {
        title: {
            text: 'Created vs Resolved Chart',
            left: 'center',
            textStyle: {
                fontSize: 18,
                fontWeight: 'bold'
            }
        },
        tooltip: {
            trigger: 'axis',
            triggerOn: 'mousemove|click',
            axisPointer: { 
                type: 'cross',
                label: {
                    backgroundColor: '#6a7985'
                }
            },
            formatter: function(params) {
                let result = params[0].axisValue + '<br/>';
                params.forEach(param => {
                    result += param.marker + param.seriesName + ': ' + param.value + '<br/>';
                });
                return result;
            }
        },
        legend: {
            data: ['Created', 'Resolved'],
            top: 35
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: labels,
            axisLabel: {
                rotate: 45,
                interval: 'auto'
            }
        },
        yAxis: [
            {
                type: 'value',
                name: 'Tickets',
                min: 0,
                position: 'left'
            },
            {
                type: 'value',
                name: 'Tickets',
                min: 0,
                position: 'right',
                axisLabel: {
                    formatter: '{value}'
                }
            }
        ],
        series: [
            {
                name: 'Created',
                type: 'line',
                data: created,
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(255, 99, 71, 0.3)' },
                            { offset: 1, color: 'rgba(255, 99, 71, 0.05)' }
                        ]
                    }
                },
                lineStyle: { color: '#ff6347', width: 2 },
                itemStyle: { color: '#ff8c69' },
                symbol: 'circle',
                symbolSize: 8,
                symbolKeepAspect: true,
                emphasis: {
                    focus: 'series',
                    itemStyle: {
                        borderWidth: 2,
                        borderColor: '#ff6347',
                        shadowBlur: 8,
                        shadowColor: 'rgba(255, 99, 71, 0.5)'
                    },
                    symbolSize: 12
                }
            },
            {
                name: 'Resolved',
                type: 'line',
                data: resolved,
                lineStyle: { color: '#32cd32', width: 2 },
                itemStyle: { color: '#32cd32' },
                symbol: 'circle',
                symbolSize: 8,
                symbolKeepAspect: true,
                emphasis: {
                    focus: 'series',
                    itemStyle: {
                        borderWidth: 2,
                        borderColor: '#32cd32',
                        shadowBlur: 8,
                        shadowColor: 'rgba(50, 205, 50, 0.5)'
                    },
                    symbolSize: 12
                }
            }
        ]
    };
    
    // Add click handler - prevent multiple opens
    let clickHandled = false;
    createdResolvedChart.off('click');
    createdResolvedChart.on('click', function(params) {
        // Prevent multiple opens from same click event
        if (clickHandled) {
            return;
        }
        
        // Handle clicks on data points
        if (params.componentType === 'series') {
            if (params.dataIndex !== undefined && data[params.dataIndex]) {
                const item = data[params.dataIndex];
                const link = params.seriesName === 'Created' 
                    ? item.jira_links.created 
                    : item.jira_links.resolved;
                if (link && link.indexOf('key = "NONE"') === -1) {
                    clickHandled = true;
                    
                    // Show notification first, then open link after delay
                    showJiraNotification();
                    setTimeout(() => {
                        window.open(link, '_blank');
                    }, 500);
                    
                    // Reset after delay to allow next click
                    setTimeout(() => {
                        clickHandled = false;
                    }, 300);
                }
            }
        }
    });
    
    if (createdResolvedChart) {
        createdResolvedChart.setOption(createdResolvedOption);
        // Force resize to ensure full width - use requestAnimationFrame for proper timing
        requestAnimationFrame(() => {
            setTimeout(() => {
                createdResolvedChart.resize();
                // Additional resize after a short delay
                setTimeout(() => {
                    createdResolvedChart.resize();
                }, 200);
            }, 50);
        });
    }
    
    // Cumulative Chart
    const periodLabel = currentFilters.period === 'weekly' ? 'grouped weekly' : 'grouped monthly';
    const cumulativeOption = {
        title: {
            text: `Cumulative Issues (${periodLabel})`,
            left: 'center',
            textStyle: {
                fontSize: 16,
                fontWeight: 'normal'
            }
        },
        tooltip: {
            show: false
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: '12%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: labels,
            axisLabel: {
                rotate: 45,
                interval: 'auto'
            }
        },
        yAxis: [
            {
                type: 'value',
                name: 'Issues',
                min: (() => {
                    // Allow negative values if data goes below zero
                    const minValue = Math.min(...cumulative);
                    return minValue < 0 ? Math.floor(minValue / 10) * 10 : 0;
                })(),
                position: 'left'
            },
            {
                type: 'value',
                name: 'Issues',
                min: (() => {
                    const minValue = Math.min(...cumulative);
                    return minValue < 0 ? Math.floor(minValue / 10) * 10 : 0;
                })(),
                position: 'right',
                axisLabel: {
                    formatter: '{value}'
                }
            }
        ],
        series: [
            {
                name: 'Cumulative Issues',
                type: 'line',
                data: cumulative,
                lineStyle: { color: '#4169e1', width: 2 },
                itemStyle: { color: '#4169e1' },
                areaStyle: {
                    color: (params) => {
                        // Make area fill conditional based on value
                        const value = params.data;
                        if (value <= 0) {
                            // No fill or very subtle for zero/negative values
                            return 'transparent';
                        } else if (value < 5) {
                            // Very light fill for small positive values
                            return {
                                type: 'linear',
                                x: 0, y: 0, x2: 0, y2: 1,
                                colorStops: [
                                    { offset: 0, color: 'rgba(65, 105, 225, 0.1)' },
                                    { offset: 1, color: 'rgba(65, 105, 225, 0.02)' }
                                ]
                            };
                        } else {
                            // Normal fill for larger values
                            return {
                                type: 'linear',
                                x: 0, y: 0, x2: 0, y2: 1,
                                colorStops: [
                                    { offset: 0, color: 'rgba(65, 105, 225, 0.3)' },
                                    { offset: 1, color: 'rgba(65, 105, 225, 0.05)' }
                                ]
                            };
                        }
                    }
                },
                symbol: 'circle',
                symbolSize: 8,
                symbolKeepAspect: true,
                emphasis: {
                    focus: 'series',
                    itemStyle: {
                        borderWidth: 2,
                        borderColor: '#4169e1',
                        shadowBlur: 8,
                        shadowColor: 'rgba(65, 105, 225, 0.5)'
                    },
                    symbolSize: 12
                }
            }
        ]
    };
    
    if (cumulativeChart) {
        cumulativeChart.setOption(cumulativeOption);
        
        // Remove any existing click handlers (cumulative chart is not clickable)
        cumulativeChart.off('click');
        
        // Force resize to ensure full width - use requestAnimationFrame for proper timing
        requestAnimationFrame(() => {
            setTimeout(() => {
                cumulativeChart.resize();
                // Additional resize after a short delay
                setTimeout(() => {
                    cumulativeChart.resize();
                }, 200);
            }, 50);
        });
    }
}

// Show/hide loading and error states
function showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('charts-container').style.display = 'none';
    document.getElementById('error').style.display = 'none';
}

function hideLoading() {
    const loadingEl = document.getElementById('loading');
    const chartsContainer = document.getElementById('charts-container');
    
    if (loadingEl) loadingEl.style.display = 'none';
    if (chartsContainer) {
        chartsContainer.style.display = 'block';
        // Force a reflow to ensure container is visible before resizing charts
        chartsContainer.offsetHeight;
    }
}

function showError() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('charts-container').style.display = 'none';
    document.getElementById('error').style.display = 'block';
}

// Show Jira login notification toast
function showJiraNotification() {
    const toast = document.getElementById('jira-toast');
    if (!toast) return;
    
    // Show toast
    toast.style.display = 'block';
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Hide toast after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300);
    }, 4000);
}

// Show Jira login notification toast
function showJiraNotification() {
    const toast = document.getElementById('jira-toast');
    if (!toast) return;
    
    // Show toast
    toast.style.display = 'block';
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Hide toast after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300);
    }, 4000);
}

// Tab Navigation
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            
            // Remove active class from all buttons and contents
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            btn.classList.add('active');
            const targetContent = document.getElementById(`${targetTab}-tab`);
            if (targetContent) {
                targetContent.classList.add('active');
                
                // Initialize tab-specific content
                if (targetTab === 'customer-distribution' && !customerPieChart) {
                    initCustomerTab();
                }
                
                if (targetTab === 'team-performance') {
                    initTeamPerformanceTab();
                }
                
                if (targetTab === 'open-items') {
                    initOpenItemsTab();
                }
                
                // Resize charts when switching to Created vs Resolved tab
                if (targetTab === 'created-resolved') {
                    requestAnimationFrame(() => {
                        setTimeout(() => {
                            if (createdResolvedChart) createdResolvedChart.resize();
                            if (cumulativeChart) cumulativeChart.resize();
                        }, 100);
                    });
                }
            }
        });
    });
    
    // Setup dashboard card clicks on Home tab
    setupDashboardCards();
}

function setupDashboardCards() {
    const dashboardCards = document.querySelectorAll('.dashboard-card');
    
    dashboardCards.forEach(card => {
        card.addEventListener('click', () => {
            const targetSection = card.dataset.section;
            
            // Find the corresponding tab button and click it
            const tabButton = document.querySelector(`.tab-btn[data-tab="${targetSection}"]`);
            if (tabButton) {
                tabButton.click();
            }
        });
    });
}

// Load Metadata Helper
async function loadMetadata() {
    const metadataResponse = await fetch(getCacheBustingUrl('data/metadata.json'));
    if (!metadataResponse.ok) {
        throw new Error(`Failed to load metadata: ${metadataResponse.status}`);
    }
    metadata = await metadataResponse.json();
    return metadata;
}

// Initialize Customer Tab
async function initCustomerTab() {
    if (!metadata) {
        try {
            await loadMetadata();
        } catch (error) {
            console.error('Error loading metadata:', error);
            return;
        }
    }
    
    // Initialize filters
    initCustomerFilters();
    
    // Initialize chart
    initCustomerPieChart();
    
    // Load initial data
    await loadCustomerData();
}

// Initialize Customer Filters
function initCustomerFilters() {
    // Set default filters (no period filter for customer tab)
    customerFilters.year = currentFilters.year || (metadata.years && metadata.years.length > 0 ? metadata.years[metadata.years.length - 1] : null);
    
    // Initialize ranges - ensure it's an array and defaults to Annual if not set
    if (!currentFilters.ranges || (Array.isArray(currentFilters.ranges) && currentFilters.ranges.length === 0)) {
        customerFilters.ranges = ['Annual'];
    } else {
        // Ensure single-select behavior
        const first = Array.isArray(currentFilters.ranges) ? currentFilters.ranges[0] : currentFilters.ranges;
        customerFilters.ranges = [first];
    }
    
    // Update year buttons
    updateCustomerYearButtons();
    
    // Update range buttons to match filter state
    updateCustomerRangeButtons();
    
    // Setup event listeners
    setupCustomerEventListeners();
}

// Update Customer Range Buttons
function updateCustomerRangeButtons() {
    const rangeButtons = document.querySelectorAll('#customer-range-buttons .btn-toggle');
    rangeButtons.forEach(btn => {
        const range = btn.dataset.range;
        if (customerFilters.ranges && customerFilters.ranges.includes(range)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Update Customer Year Buttons
function updateCustomerYearButtons() {
    const yearButtonsContainer = document.getElementById('customer-year-buttons');
    if (!yearButtonsContainer || !metadata || !metadata.years) return;
    
    yearButtonsContainer.innerHTML = '';
    
    metadata.years.forEach(year => {
        const btn = document.createElement('button');
        btn.type = 'button'; // Prevent form submission
        btn.className = 'btn-toggle';
        if (year === customerFilters.year) {
            btn.classList.add('active');
        }
        btn.dataset.year = year;
        btn.textContent = year;
        yearButtonsContainer.appendChild(btn);
    });
}

// Setup Customer Event Listeners
function setupCustomerEventListeners() {
    // Year buttons
    document.querySelectorAll('#customer-year-buttons .btn-toggle').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            btn.blur(); // Remove focus to prevent scroll
            const savedScroll = window.pageYOffset || document.documentElement.scrollTop;
            document.querySelectorAll('#customer-year-buttons .btn-toggle').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            customerFilters.year = parseInt(btn.dataset.year);
            await loadCustomerData();
            // Restore scroll position multiple times to handle async DOM updates
            requestAnimationFrame(() => {
                window.scrollTo(0, savedScroll);
                setTimeout(() => {
                    window.scrollTo(0, savedScroll);
                }, 100);
                setTimeout(() => {
                    window.scrollTo(0, savedScroll);
                }, 300);
            });
        });
    });
    
    // Range buttons
    document.querySelectorAll('#customer-range-buttons .btn-toggle').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            btn.blur(); // Remove focus to prevent scroll
            const savedScroll = window.pageYOffset || document.documentElement.scrollTop;
            const range = btn.dataset.range;

            // RADIO behavior: only one active at a time
            document.querySelectorAll('#customer-range-buttons .btn-toggle').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            customerFilters.ranges = [range];

            console.log('Customer filters updated:', customerFilters);
            await loadCustomerData();
            // Restore scroll position multiple times to handle async DOM updates
            requestAnimationFrame(() => {
                window.scrollTo(0, savedScroll);
                setTimeout(() => {
                    window.scrollTo(0, savedScroll);
                }, 100);
                setTimeout(() => {
                    window.scrollTo(0, savedScroll);
                }, 300);
            });
        });
    });
}

// Initialize Customer Pie Chart
function initCustomerPieChart() {
    const chartDom = document.getElementById('customer-pie-chart');
    if (!chartDom) return;
    
    // Ensure container has proper dimensions before initialization
    const container = chartDom.parentElement;
    if (container) {
        container.style.display = 'block';
        container.style.width = '100%';
    }
    
    customerPieChart = echarts.init(chartDom);
    
    // Handle window resize
    window.addEventListener('resize', () => {
        if (customerPieChart) {
            customerPieChart.resize();
        }
    });
}

// Load Customer Data for Pie Chart
async function loadCustomerData() {
    const loadingEl = document.getElementById('customer-loading');
    const chartsEl = document.getElementById('customer-charts-container');
    const errorEl = document.getElementById('customer-error');
    
    // Hide error if visible
    if (errorEl) {
        errorEl.style.display = 'none';
    }
    
    // Show loading overlay smoothly
    if (loadingEl) {
        loadingEl.style.display = 'block';
        loadingEl.style.opacity = '0';
        requestAnimationFrame(() => {
            loadingEl.style.transition = 'opacity 0.2s ease';
            loadingEl.style.opacity = '1';
        });
    }
    
    // Fade out chart slightly while loading
    if (chartsEl) {
        chartsEl.style.opacity = '0.5';
        chartsEl.style.transition = 'opacity 0.3s ease';
        chartsEl.style.display = 'block'; // Keep visible
    }
    
    try {
        if (!customerFilters.year) {
            throw new Error('Year not selected');
        }
        
        // Ensure container is visible and has proper dimensions before rendering
        if (chartsEl) {
            chartsEl.style.display = 'block';
            chartsEl.style.width = '100%';
        }
        
        // Ensure chart wrapper has proper dimensions
        const chartWrapper = document.querySelector('#customer-charts-container .chart-wrapper');
        if (chartWrapper) {
            chartWrapper.style.width = '100%';
            chartWrapper.style.display = 'block';
        }
        
        // Aggregate data from all customers
        const customerData = await aggregateCustomerData();
        console.log('[DEBUG] aggregateCustomerData returned:', customerData);
        console.log('[DEBUG] Customer count:', Object.keys(customerData).length);
        console.log('[DEBUG] Total tickets:', Object.values(customerData).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0));
        
        // Filter by range
        const filteredData = filterCustomerDataByRange(customerData);
        console.log('[DEBUG] After filterCustomerDataByRange:', filteredData);
        console.log('[DEBUG] Filtered customer count:', Object.keys(filteredData).length);
        console.log('[DEBUG] Filtered total tickets:', Object.values(filteredData).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0));
        
        // Render pie chart with smooth animation
        renderCustomerPieChart(filteredData);
        
        // Hide loading and restore chart opacity smoothly
        if (loadingEl) {
            loadingEl.style.opacity = '0';
            setTimeout(() => {
                loadingEl.style.display = 'none';
            }, 200);
        }
        
        if (chartsEl) {
            chartsEl.style.opacity = '1';
        }
        
        // Resize chart after transition - multiple calls to ensure proper sizing
        setTimeout(() => {
            if (customerPieChart) {
                customerPieChart.resize();
            }
        }, 100);
        
        setTimeout(() => {
            if (customerPieChart) {
                customerPieChart.resize();
            }
        }, 300);
        
        setTimeout(() => {
            if (customerPieChart) {
                customerPieChart.resize();
            }
        }, 500);
    } catch (error) {
        console.error('Error loading customer data:', error);
        if (errorEl) {
            errorEl.style.display = 'block';
        }
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
        if (chartsEl) {
            chartsEl.style.display = 'none';
        }
    }
}

// Aggregate Customer Data (now loads pre-aggregated server-side data)
async function aggregateCustomerData() {
    const year = customerFilters.year;
    const ranges = customerFilters.ranges;
    
    if (!year || !ranges || ranges.length === 0) {
        console.warn('No year or ranges selected:', { year, ranges });
        return {};
    }
    
    // Build filename based on selected ranges
    let rangeKey;
    if (ranges.includes('Annual')) {
        rangeKey = 'Annual';
    } else if (ranges.length === 1) {
        rangeKey = ranges[0];
    } else {
        // Multiple quarters selected - create combined key
        const sortedRanges = ranges.sort();
        // If all 4 quarters are selected, treat as Annual
        if (sortedRanges.length === 4 && sortedRanges.includes('Q1') && sortedRanges.includes('Q2') && 
            sortedRanges.includes('Q3') && sortedRanges.includes('Q4')) {
            rangeKey = 'Annual';
        } else {
            rangeKey = sortedRanges.join('+');
        }
    }
    
    // Load pre-aggregated customer distribution file
    const filename = `data/customer-distribution-${year}-${rangeKey}.json`;
    console.log('Loading customer distribution file:', filename);
    
    try {
        const response = await fetch(getCacheBustingUrl(filename));
        if (!response.ok) {
            throw new Error(`Failed to load ${filename}: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('[DEBUG] Loaded customer distribution data:', data);
        console.log('[DEBUG] Distribution keys:', Object.keys(data.distribution || {}));
        console.log('[DEBUG] Total tickets:', Object.values(data.distribution || {}).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0));
        
        if (!data.distribution || Object.keys(data.distribution).length === 0) {
            console.warn('[DEBUG] Distribution data is empty for:', filename);
            return {};
        }
        
        const distribution = data.distribution || {};
        console.log('[DEBUG] Returning distribution with', Object.keys(distribution).length, 'customers');
        return distribution;
    } catch (error) {
        console.error('Error loading customer distribution:', error);
        console.error('Attempted filename:', filename);
        return {};
    }
}

// Filter Customer Data by Range (now handled server-side)
function filterCustomerDataByRange(customerCounts) {
    // Data is already filtered server-side, so just return as-is
    return customerCounts;
}

// Get date range for JQL based on filters
function getDateRangeForJQL() {
    const year = customerFilters.year;
    const ranges = customerFilters.ranges;
    
    if (!year || !ranges || ranges.length === 0) {
        return null;
    }
    
    const quarterMonths = {
        'Q1': { start: 1, end: 3 },
        'Q2': { start: 4, end: 6 },
        'Q3': { start: 7, end: 9 },
        'Q4': { start: 10, end: 12 }
    };
    
    let startMonth = 1;
    let endMonth = 12;
    
    if (ranges.includes('Annual')) {
        // Annual: entire year
        startMonth = 1;
        endMonth = 12;
    } else {
        // Get min start month and max end month from selected quarters
        const selectedQuarters = ranges.filter(r => quarterMonths[r]);
        if (selectedQuarters.length > 0) {
            startMonth = Math.min(...selectedQuarters.map(q => quarterMonths[q].start));
            endMonth = Math.max(...selectedQuarters.map(q => quarterMonths[q].end));
        }
    }
    
    // Calculate start and end dates
    const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
    const endYear = endMonth === 12 ? year + 1 : year;
    const endMonthNext = endMonth === 12 ? 1 : endMonth + 1;
    const endDate = `${endYear}-${String(endMonthNext).padStart(2, '0')}-01`;
    
    return { startDate, endDate };
}

// Generate Jira JQL for customer
function generateCustomerJQL(customerName) {
    // Get date range from filters
    const dateRange = getDateRangeForJQL();
    const dateFilter = dateRange 
        ? ` AND created >= "${dateRange.startDate}" AND created < "${dateRange.endDate}"`
        : '';
    
    // Handle ONE Albania specially
    if (customerName === 'ONE Albania' || /one\s+albania/i.test(customerName)) {
        const oneAlbaniaJQL = `project in (${JIRA_PROJECTS_JQL}) AND issuetype NOT IN (Sub-task, RAG) AND "Link to Central Zendesk[URL Field]" IS NOT EMPTY AND (text ~ "One Albania" OR text ~ "STL - One Albania")${dateFilter} order by created desc`;
        return encodeURIComponent(oneAlbaniaJQL);
    }
    
    // Handle "Others" - don't create link
    if (customerName.startsWith('Others')) {
        return null;
    }
    
    // For individual customers, use PS Customer Name field - search across all projects
    const customerJQL = `project in (${JIRA_PROJECTS_JQL}) AND type not in (Sub-task, RAG) AND "PS Customer Name[Short text]" ~ "${customerName}"${dateFilter} ORDER BY key desc`;
    return encodeURIComponent(customerJQL);
}

// Render Customer Pie Chart
function renderCustomerPieChart(customerData) {
    if (!customerPieChart) return;
    
    // Store original customer names for JQL generation
    const customerNameMap = {};
    Object.entries(customerData).forEach(([name, value]) => {
        customerNameMap[name] = name;
    });
    
    // Convert to ECharts format
    const pieData = Object.entries(customerData)
        .sort((a, b) => b[1] - a[1]) // Sort by count descending
        .slice(0, 20) // Top 20 customers
        .map(([name, value]) => ({
            name: name.length > 30 ? name.substring(0, 30) + '...' : name,
            value: value,
            originalName: name // Store original name for JQL
        }));
    
    // Calculate total for "Others" if more than 20 customers
    const allEntries = Object.entries(customerData).sort((a, b) => b[1] - a[1]);
    if (allEntries.length > 20) {
        const othersTotal = allEntries.slice(20).reduce((sum, [, value]) => sum + value, 0);
        if (othersTotal > 0) {
            pieData.push({
                name: `Others (${allEntries.length - 20} customers)`,
                value: othersTotal,
                originalName: 'Others' // Mark as Others
            });
        }
    }
    
    const option = {
        animation: true,
        animationDuration: 500,
        animationEasing: 'cubicOut',
        title: {
            text: 'Customer Distribution',
            left: 'center',
            textStyle: {
                fontSize: 20,
                fontWeight: 600,
                color: '#1a1a1a'
            },
            subtext: `Total Tickets: ${Object.values(customerData).reduce((a, b) => a + b, 0)}`,
            subtextStyle: {
                fontSize: 14,
                color: '#666'
            }
        },
        tooltip: {
            trigger: 'item',
            formatter: function(params) {
                const name = params.data.originalName || params.name;
                return `${name}: ${params.value} tickets (${params.percent}%)<br/><span style="color: #667eea; font-size: 11px;">Click to view in Jira</span>`;
            },
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderColor: '#667eea',
            borderWidth: 1,
            textStyle: {
                color: '#fff'
            }
        },
        legend: {
            type: 'scroll',
            orient: 'vertical',
            right: 30,
            top: 'middle',
            itemWidth: 12,
            itemHeight: 12,
            textStyle: {
                fontSize: 12
            },
            formatter: function(name) {
                const item = pieData.find(d => d.name === name);
                return item ? `${name}: ${item.value}` : name;
            }
        },
        series: [
            {
                name: 'Tickets',
                type: 'pie',
                radius: ['40%', '70%'],
                center: ['50%', '55%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 8,
                    borderColor: '#fff',
                    borderWidth: 2
                },
                label: {
                    show: true,
                    formatter: '{b}\n{d}%',
                    fontSize: 11
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 14,
                        fontWeight: 'bold'
                    },
                    itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                },
                data: pieData
            }
        ],
        color: [
            '#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b',
            '#fa709a', '#fee140', '#30cfd0', '#a8edea', '#fed6e3',
            '#ffecd2', '#fcb69f', '#ff9a9e', '#fecfef', '#fad0c4',
            '#ffd1ff', '#a1c4fd', '#c2e9fb', '#fbc2eb', '#a8edea'
        ]
    };
    
    // Use notMerge: false to enable smooth transitions
    customerPieChart.setOption(option, { notMerge: false, lazyUpdate: false });
    
    // Ensure chart renders at full width - call resize multiple times to handle layout timing
    setTimeout(() => {
        if (customerPieChart) {
            customerPieChart.resize();
        }
    }, 0);
    
    setTimeout(() => {
        if (customerPieChart) {
            customerPieChart.resize();
        }
    }, 100);
    
    setTimeout(() => {
        if (customerPieChart) {
            customerPieChart.resize();
        }
    }, 300);
    
    // Add click handler for pie chart segments
    customerPieChart.off('click');
    customerPieChart.on('click', function(params) {
        if (params.componentType === 'series' && params.data) {
            const customerName = params.data.originalName || params.name;
            
            // Skip "Others" - no link
            if (customerName.startsWith('Others')) {
                return;
            }
            
            // Generate JQL for customer
            const jql = generateCustomerJQL(customerName);
            if (jql) {
                const jiraUrl = `https://psskyvera.atlassian.net/issues/?jql=${jql}`;
                
                    // Show notification first, then open link after delay
                    showJiraNotification();
                    setTimeout(() => {
                        window.open(jiraUrl, '_blank');
                    }, 500);
            }
        }
    });
}

// Team Performance Tab Functions
function initTeamPerformanceTab() {
    if (!metadata || !metadata.years) {
        console.error('Metadata not loaded');
        return;
    }
    
    // Initialize filters if not already set
    if (!teamFilters.year) {
        teamFilters.year = metadata.years[metadata.years.length - 1]; // Most recent year
    }
    if (!teamFilters.range) {
        teamFilters.range = 'Q4';
    }
    
    // Load saved filters from localStorage
    try {
        const saved = localStorage.getItem('amc-dashboard-team-filters');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.year && metadata.years.includes(parsed.year)) {
                teamFilters.year = parsed.year;
            }
            if (parsed.range && ['Q1', 'Q2', 'Q3', 'Q4'].includes(parsed.range)) {
                teamFilters.range = parsed.range;
            }
        }
    } catch (e) {
        console.warn('Could not load team filters from localStorage:', e);
    }
    
    initTeamFilters();
    loadTeamPerformanceData();
}

function initTeamFilters() {
    // Initialize year buttons
    updateTeamYearButtons();
    
    // Initialize range buttons
    updateTeamRangeButtons();
    
    // Setup event listeners
    setupTeamEventListeners();
}

function updateTeamYearButtons() {
    const container = document.getElementById('team-year-buttons');
    if (!container || !metadata || !metadata.years) return;
    
    container.innerHTML = '';
    metadata.years.forEach(year => {
        const btn = document.createElement('button');
        btn.type = 'button'; // Prevent form submission
        btn.className = `btn-toggle ${teamFilters.year === year ? 'active' : ''}`;
        btn.textContent = year.toString();
        btn.dataset.year = year.toString();
        container.appendChild(btn);
    });
}

function updateTeamRangeButtons() {
    const container = document.getElementById('team-range-buttons');
    if (!container) return;
    
    const buttons = container.querySelectorAll('.btn-toggle');
    buttons.forEach(btn => {
        const range = btn.dataset.range;
        if (range === teamFilters.range) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function setupTeamEventListeners() {
    // Year button listeners
    const yearButtons = document.getElementById('team-year-buttons');
    if (yearButtons) {
        yearButtons.addEventListener('click', async (e) => {
            if (e.target.classList.contains('btn-toggle')) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                e.target.blur(); // Remove focus to prevent scroll
                const savedScroll = window.pageYOffset || document.documentElement.scrollTop;
                const year = parseInt(e.target.dataset.year);
                teamFilters.year = year;
                
                // Update UI
                yearButtons.querySelectorAll('.btn-toggle').forEach(btn => {
                    btn.classList.remove('active');
                });
                e.target.classList.add('active');
                
                // Save and reload
                saveTeamFiltersToStorage();
                await loadTeamPerformanceData();
                // Restore scroll position multiple times to handle async DOM updates
                requestAnimationFrame(() => {
                    window.scrollTo(0, savedScroll);
                    setTimeout(() => {
                        window.scrollTo(0, savedScroll);
                    }, 100);
                    setTimeout(() => {
                        window.scrollTo(0, savedScroll);
                    }, 300);
                });
            }
        });
    }
    
    // Range button listeners (radio button behavior)
    const rangeButtons = document.getElementById('team-range-buttons');
    if (rangeButtons) {
        rangeButtons.addEventListener('click', async (e) => {
            if (e.target.classList.contains('btn-toggle')) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                e.target.blur(); // Remove focus to prevent scroll
                const savedScroll = window.pageYOffset || document.documentElement.scrollTop;
                const range = e.target.dataset.range;
                teamFilters.range = range;
                
                // Update UI (radio button behavior - only one active)
                rangeButtons.querySelectorAll('.btn-toggle').forEach(btn => {
                    btn.classList.remove('active');
                });
                e.target.classList.add('active');
                
                // Save and reload
                saveTeamFiltersToStorage();
                await loadTeamPerformanceData();
                // Restore scroll position multiple times to handle async DOM updates
                requestAnimationFrame(() => {
                    window.scrollTo(0, savedScroll);
                    setTimeout(() => {
                        window.scrollTo(0, savedScroll);
                    }, 100);
                    setTimeout(() => {
                        window.scrollTo(0, savedScroll);
                    }, 300);
                });
            }
        });
    }
}

function saveTeamFiltersToStorage() {
    try {
        localStorage.setItem('amc-dashboard-team-filters', JSON.stringify(teamFilters));
    } catch (e) {
        console.warn('Could not save team filters to localStorage:', e);
    }
}

async function loadTeamPerformanceData() {
    if (!teamFilters.year || !teamFilters.range) {
        console.error('Year or range not set');
        return;
    }
    
    const containerEl = document.getElementById('team-performance-container');
    const loadingEl = document.getElementById('team-loading');
    const errorEl = document.getElementById('team-error');
    
    // Hide error if visible
    if (errorEl) errorEl.style.display = 'none';
    
    // Show loading overlay without hiding container (smooth transition)
    if (loadingEl) {
        loadingEl.style.display = 'block';
        loadingEl.style.opacity = '0';
        requestAnimationFrame(() => {
            loadingEl.style.transition = 'opacity 0.2s ease';
            loadingEl.style.opacity = '1';
        });
    }
    
    // Fade out table slightly while loading
    if (containerEl) {
        containerEl.style.opacity = '0.5';
        containerEl.style.transition = 'opacity 0.2s ease';
    }
    
    try {
        const filename = `team-performance-${teamFilters.year}-${teamFilters.range}.json`;
        const response = await fetch(getCacheBustingUrl(`data/${filename}`));
        
        if (!response.ok) {
            throw new Error(`Failed to load ${filename}: ${response.status}`);
        }
        
        const data = await response.json();
        teamPerformanceData = data;
        
        // Render table (this happens while container is still visible but faded)
        renderTeamPerformanceTable(data);
        
        // Hide loading and restore table opacity smoothly
        if (loadingEl) {
            loadingEl.style.opacity = '0';
            setTimeout(() => {
                loadingEl.style.display = 'none';
            }, 200);
        }
        
        if (containerEl) {
            containerEl.style.opacity = '1';
            containerEl.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading team performance data:', error);
        showTeamError();
    }
}

function renderTeamPerformanceTable(data) {
    const container = document.getElementById('team-performance-container');
    const table = document.getElementById('team-performance-table');
    
    if (!container || !table || !data) {
        return;
    }
    
    // Clear existing table
    table.innerHTML = '';
    
    const weeks = data.weeks || [];
    const assignees = data.assignees || [];
    const tableData = data.data || {};
    const weekTotals = data.week_totals || {};
    const grandTotal = data.grand_total || 0;
    
    // Create header row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    // Assignee column header
    const assigneeHeader = document.createElement('th');
    assigneeHeader.textContent = 'Assignee';
    assigneeHeader.className = 'assignee-header';
    headerRow.appendChild(assigneeHeader);
    
    // Week headers
    weeks.forEach(week => {
        const th = document.createElement('th');
        th.textContent = week;
        th.className = 'week-header';
        headerRow.appendChild(th);
    });
    
    // Grand Total header
    const grandTotalHeader = document.createElement('th');
    grandTotalHeader.textContent = 'Grand Total';
    grandTotalHeader.className = 'grand-total-header';
    headerRow.appendChild(grandTotalHeader);
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    
    assignees.forEach(assignee => {
        const row = document.createElement('tr');
        
        // Assignee name cell
        const assigneeCell = document.createElement('td');
        assigneeCell.textContent = assignee;
        assigneeCell.className = 'assignee-cell';
        row.appendChild(assigneeCell);
        
        // Week cells
        weeks.forEach(week => {
            const cell = document.createElement('td');
            const cellData = tableData[assignee]?.[week] || { count: 0, keys: [] };
            const count = cellData.count || 0;
            const keys = cellData.keys || [];
            
            if (count > 0 && keys.length > 0) {
                // Create clickable link
                const link = document.createElement('a');
                link.href = '#';
                link.textContent = count.toString();
                link.className = 'table-cell-link';
                link.dataset.keys = JSON.stringify(keys);
                
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const cellKeys = JSON.parse(e.target.dataset.keys);
                    if (cellKeys && cellKeys.length > 0) {
                        const jiraUrl = generateJiraLinkFromKeys(cellKeys);
                        showJiraNotification();
                        window.open(jiraUrl, '_blank');
                    }
                });
                
                cell.appendChild(link);
            } else {
                cell.textContent = count > 0 ? count.toString() : '';
            }
            
            cell.className = 'week-cell';
            row.appendChild(cell);
        });
        
        // Grand Total cell for this assignee (clickable if has tickets)
        const assigneeTotalCell = document.createElement('td');
        const assigneeTotal = tableData[assignee]?.total || 0;
        
        // Collect all keys for this assignee across all weeks
        const assigneeAllKeys = [];
        weeks.forEach(week => {
            const cellData = tableData[assignee]?.[week] || { keys: [] };
            if (cellData.keys && cellData.keys.length > 0) {
                assigneeAllKeys.push(...cellData.keys);
            }
        });
        const uniqueAssigneeKeys = [...new Set(assigneeAllKeys)];
        
        if (assigneeTotal > 0 && uniqueAssigneeKeys.length > 0) {
            // Make it clickable
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = assigneeTotal.toString();
            link.className = 'table-cell-link';
            link.dataset.keys = JSON.stringify(uniqueAssigneeKeys);
            
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const cellKeys = JSON.parse(e.target.dataset.keys);
                if (cellKeys && cellKeys.length > 0) {
                    const jiraUrl = generateJiraLinkFromKeys(cellKeys);
                    showJiraNotification();
                    window.open(jiraUrl, '_blank');
                }
            });
            
            assigneeTotalCell.appendChild(link);
        } else {
            assigneeTotalCell.textContent = assigneeTotal.toString();
        }
        
        assigneeTotalCell.className = 'assignee-total-cell';
        row.appendChild(assigneeTotalCell);
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    
    // Create footer row with week totals
    const tfoot = document.createElement('tfoot');
    const footerRow = document.createElement('tr');
    
    // Grand Total label
    const grandTotalLabel = document.createElement('td');
    grandTotalLabel.textContent = 'Grand Total';
    grandTotalLabel.className = 'grand-total-label';
    footerRow.appendChild(grandTotalLabel);
    
        // Week totals (clickable if has tickets)
        weeks.forEach(week => {
            const cell = document.createElement('td');
            const total = weekTotals[week] || 0;
            
            // Collect all keys for this week across all assignees
            const weekAllKeys = [];
            assignees.forEach(assignee => {
                const cellData = tableData[assignee]?.[week] || { keys: [] };
                if (cellData.keys && cellData.keys.length > 0) {
                    weekAllKeys.push(...cellData.keys);
                }
            });
            const uniqueWeekKeys = [...new Set(weekAllKeys)];
            
            if (total > 0 && uniqueWeekKeys.length > 0) {
                // Make it clickable
                const link = document.createElement('a');
                link.href = '#';
                link.textContent = total.toString();
                link.className = 'table-cell-link';
                link.dataset.keys = JSON.stringify(uniqueWeekKeys);
                
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const cellKeys = JSON.parse(e.target.dataset.keys);
                    if (cellKeys && cellKeys.length > 0) {
                        const jiraUrl = generateJiraLinkFromKeys(cellKeys);
                        showJiraNotification();
                        window.open(jiraUrl, '_blank');
                    }
                });
                
                cell.appendChild(link);
            } else {
                cell.textContent = total.toString();
            }
            
            cell.className = 'week-total-cell';
            footerRow.appendChild(cell);
        });
    
        // Overall grand total (clickable - all tickets)
        const overallTotalCell = document.createElement('td');
        
        // Collect all keys from entire dataset
        const allKeys = [];
        assignees.forEach(assignee => {
            weeks.forEach(week => {
                const cellData = tableData[assignee]?.[week] || { keys: [] };
                if (cellData.keys && cellData.keys.length > 0) {
                    allKeys.push(...cellData.keys);
                }
            });
        });
        const uniqueAllKeys = [...new Set(allKeys)];
        
        if (grandTotal > 0 && uniqueAllKeys.length > 0) {
            // Make it clickable
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = grandTotal.toString();
            link.className = 'table-cell-link';
            link.dataset.keys = JSON.stringify(uniqueAllKeys);
            
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const cellKeys = JSON.parse(e.target.dataset.keys);
                if (cellKeys && cellKeys.length > 0) {
                    const jiraUrl = generateJiraLinkFromKeys(cellKeys);
                    showJiraNotification();
                    window.open(jiraUrl, '_blank');
                }
            });
            
            overallTotalCell.appendChild(link);
        } else {
            overallTotalCell.textContent = grandTotal.toString();
        }
        
        overallTotalCell.className = 'overall-total-cell';
        footerRow.appendChild(overallTotalCell);
    
    tfoot.appendChild(footerRow);
    table.appendChild(tfoot);
    
    // Show container
    container.style.display = 'block';
}

function generateJiraLinkFromKeys(keys) {
    const baseUrl = 'https://psskyvera.atlassian.net/issues/?jql=';
    
    if (!keys || keys.length === 0) {
        return `${baseUrl}key = "NONE"`;
    }
    
    // Format keys for JQL: key in ('KEY1', 'KEY2', ...)
    const keysStr = keys.map(key => `'${key}'`).join(', ');
    const jql = `key in (${keysStr}) ORDER BY key DESC`;
    return `${baseUrl}${encodeURIComponent(jql)}`;
}

function showTeamLoading() {
    const loadingEl = document.getElementById('team-loading');
    const containerEl = document.getElementById('team-performance-container');
    const errorEl = document.getElementById('team-error');
    
    if (errorEl) errorEl.style.display = 'none';
    // Don't hide container - just show loading overlay
    if (loadingEl) {
        loadingEl.style.display = 'block';
        loadingEl.style.opacity = '1';
    }
    if (containerEl) {
        containerEl.style.opacity = '0.5';
    }
}

function hideTeamLoading() {
    const loadingEl = document.getElementById('team-loading');
    const containerEl = document.getElementById('team-performance-container');
    
    if (loadingEl) {
        loadingEl.style.opacity = '0';
        setTimeout(() => {
            loadingEl.style.display = 'none';
        }, 200);
    }
    if (containerEl) {
        containerEl.style.opacity = '1';
        containerEl.style.display = 'block';
    }
}

function showTeamError() {
    const loadingEl = document.getElementById('team-loading');
    const containerEl = document.getElementById('team-performance-container');
    const errorEl = document.getElementById('team-error');
    
    if (loadingEl) loadingEl.style.display = 'none';
    if (containerEl) containerEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'block';
}

// Open Items Tab Functions
let openItemsData = null;
let openItemsBarChart = null;
let filteredTickets = null;

async function initOpenItemsTab() {
    if (openItemsData) {
        // Data already loaded, just render
        renderOpenItemsData();
        return;
    }
    
    try {
        showOpenItemsLoading();
        const response = await fetch(getCacheBustingUrl('data/open-items.json'));
        
        if (!response.ok) {
            throw new Error(`Failed to load open items: ${response.status}`);
        }
        
        openItemsData = await response.json();
        filteredTickets = openItemsData.tickets; // Start with all tickets
        
        renderOpenItemsData();
        hideOpenItemsLoading();
    } catch (error) {
        console.error('Error loading open items:', error);
        showOpenItemsError();
    }
}

function renderOpenItemsData() {
    if (!openItemsData) return;
    
    renderCustomerDistributionChart();
    renderCustomerSummaryTable();
    renderDetailedTicketsTable();
}

function renderCustomerDistributionChart() {
    const chartEl = document.getElementById('open-items-pie-chart');
    if (!chartEl) return;
    
    if (openItemsBarChart) {
        openItemsBarChart.dispose();
    }
    
    openItemsBarChart = echarts.init(chartEl);
    
    const distribution = openItemsData.customer_distribution;
    const totalCount = openItemsData.total_count;
    
    // Prepare data sorted by count (descending)
    const data = Object.entries(distribution)
        .map(([customer, info]) => ({
            name: customer,
            value: info.count,
            percentage: totalCount > 0 ? ((info.count / totalCount) * 100).toFixed(2) : 0,
            keys: info.keys
        }))
        .sort((a, b) => b.value - a.value);
    
    const customerNames = data.map(item => item.name);
    const counts = data.map(item => item.value);
    
    const option = {
        title: {
            text: `Open Items by Customer (${totalCount} tickets)`,
            left: 'center',
            top: 10,
            textStyle: {
                fontSize: 18,
                fontWeight: 'bold',
                color: '#333'
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            },
            formatter: function(params) {
                const param = params[0];
                const item = data[param.dataIndex];
                return `${param.name}<br/>Open Items: ${param.value} (${item.percentage}%)`;
            }
        },
        grid: {
            left: '10%',
            right: '10%',
            top: '20%',
            bottom: '25%',
            containLabel: false
        },
        xAxis: {
            type: 'category',
            data: customerNames,
            axisLabel: {
                interval: 0,
                rotate: 45,
                formatter: function(value) {
                    // Truncate long names if needed
                    return value.length > 20 ? value.substring(0, 17) + '...' : value;
                }
            }
        },
        yAxis: {
            type: 'value',
            name: 'Open Items',
            nameLocation: 'middle',
            nameGap: 50,
            axisLabel: {
                formatter: '{value}'
            }
        },
        series: [{
            name: 'Open Items',
            type: 'bar',
            data: counts.map((count, index) => ({
                value: count,
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 1, 0, 0, [
                        { offset: 0, color: '#667eea' },
                        { offset: 1, color: '#764ba2' }
                    ]),
                    borderRadius: [4, 4, 0, 0]
                }
            })),
            label: {
                show: true,
                position: 'top',
                formatter: function(params) {
                    const item = data[params.dataIndex];
                    return `${params.value} (${item.percentage}%)`;
                },
                color: '#333',
                fontWeight: '500'
            },
            emphasis: {
                itemStyle: {
                    shadowBlur: 10,
                    shadowColor: 'rgba(102, 126, 234, 0.5)'
                }
            },
            barWidth: '60%'
        }]
    };
    
    openItemsBarChart.setOption(option);
    
    // Add click handler
    openItemsBarChart.on('click', (params) => {
        const customerIndex = params.dataIndex;
        const item = data[customerIndex];
        if (item && item.keys && item.keys.length > 0) {
            const jiraUrl = generateJiraLinkFromKeys(item.keys);
            showJiraNotification();
            setTimeout(() => {
                window.open(jiraUrl, '_blank');
            }, 500);
        }
    });
    
    // Resize chart
    setTimeout(() => {
        if (openItemsBarChart) openItemsBarChart.resize();
    }, 100);
}

function renderCustomerSummaryTable() {
    const tbody = document.getElementById('customer-summary-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    openItemsData.customer_summary.forEach(customer => {
        const row = document.createElement('tr');
        
        // Color code average age
        let ageClass = '';
        const avgAge = customer.average_age_days;
        if (avgAge <= 30) ageClass = 'age-green';
        else if (avgAge <= 60) ageClass = 'age-yellow';
        else if (avgAge <= 90) ageClass = 'age-orange';
        else ageClass = 'age-red';
        
        row.innerHTML = `
            <td><a href="#" class="customer-link" data-customer="${customer.customer}">${customer.customer}</a></td>
            <td>${customer.total_open_items}</td>
            <td class="${ageClass}">${customer.average_age_label}</td>
        `;
        
        // Add click handler for customer link
        const link = row.querySelector('.customer-link');
        link.addEventListener('click', (e) => {
            e.preventDefault();
            filterTicketsByCustomer(customer.customer);
        });
        
        tbody.appendChild(row);
    });
}

function renderDetailedTicketsTable() {
    const tbody = document.getElementById('detailed-tickets-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!filteredTickets || filteredTickets.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" style="text-align: center; padding: 20px;">No tickets found</td>';
        tbody.appendChild(row);
        return;
    }
    
    filteredTickets.forEach((ticket, index) => {
        const row = document.createElement('tr');
        
        // Color code age
        let ageClass = '';
        const ageDays = ticket.age_days;
        if (ageDays <= 30) ageClass = 'age-green';
        else if (ageDays <= 60) ageClass = 'age-yellow';
        else if (ageDays <= 90) ageClass = 'age-orange';
        else ageClass = 'age-red';
        
        const jiraUrl = `https://psskyvera.atlassian.net/browse/${ticket.key}`;
        const kayakoUrl = ticket.kayako_number ? `https://central-supportdesk.kayako.com/agent/conversations/${ticket.kayako_number}` : '#';
        const serialNumber = index + 1;
        
        row.innerHTML = `
            <td style="text-align: center; font-weight: 500; color: #666;">${serialNumber}</td>
            <td><a href="${jiraUrl}" target="_blank" class="ticket-link">${ticket.key}</a></td>
            <td><a href="${jiraUrl}" target="_blank" class="ticket-link">${ticket.title}</a></td>
            <td>${ticket.kayako_number ? `<a href="${kayakoUrl}" target="_blank" class="kayako-link">${ticket.kayako_number}</a>` : 'N/A'}</td>
            <td>${ticket.created_formatted}</td>
            <td class="${ageClass}">${ticket.age_label}</td>
        `;
        
        // Add click handlers for Jira links
        row.querySelectorAll('.ticket-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                showJiraNotification();
                setTimeout(() => {
                    window.open(jiraUrl, '_blank');
                }, 500);
            });
        });
        
        tbody.appendChild(row);
    });
}

function filterTicketsByCustomer(customer) {
    if (!openItemsData) return;
    
    if (customer === 'All') {
        filteredTickets = openItemsData.tickets;
    } else {
        filteredTickets = openItemsData.tickets.filter(t => t.customer === customer);
    }
    
    renderDetailedTicketsTable();
    
    // Scroll to detailed table
    const wrapper = document.getElementById('detailed-tickets-wrapper');
    if (wrapper) {
        wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function generateJiraLinkFromKeys(keys) {
    if (!keys || keys.length === 0) {
        return 'https://psskyvera.atlassian.net/issues/?jql=key = "NONE"';
    }
    
    const baseUrl = 'https://psskyvera.atlassian.net/issues/?jql=';
    const keysStr = keys.map(k => `'${k}'`).join(', ');
    const jql = `key in (${keysStr}) ORDER BY key DESC`;
    return `${baseUrl}${encodeURIComponent(jql)}`;
}

function showOpenItemsLoading() {
    const loadingEl = document.getElementById('open-items-loading');
    const containerEl = document.getElementById('open-items-container');
    const errorEl = document.getElementById('open-items-error');
    
    if (loadingEl) loadingEl.style.display = 'block';
    if (containerEl) containerEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
}

function hideOpenItemsLoading() {
    const loadingEl = document.getElementById('open-items-loading');
    const containerEl = document.getElementById('open-items-container');
    
    if (loadingEl) {
        setTimeout(() => {
            loadingEl.style.display = 'none';
        }, 200);
    }
    if (containerEl) {
        containerEl.style.opacity = '1';
        containerEl.style.display = 'block';
    }
}

function showOpenItemsError() {
    const loadingEl = document.getElementById('open-items-loading');
    const containerEl = document.getElementById('open-items-container');
    const errorEl = document.getElementById('open-items-error');
    
    if (loadingEl) loadingEl.style.display = 'none';
    if (containerEl) containerEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'block';
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setupTabs();
        init();
    });
} else {
    setupTabs();
    init();
}

