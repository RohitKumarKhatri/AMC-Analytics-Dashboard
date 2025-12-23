// Service Worker for Cache Control (5 minutes max)
const CACHE_NAME = 'amc-dashboard-v3';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Install event
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - implement 5-minute cache
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Only cache GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Skip cross-origin requests (CDN resources)
    if (url.origin !== location.origin) {
        return;
    }
    
    // Skip HTML files - always fetch fresh
    if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
        return;
    }
    
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((cachedResponse) => {
                const now = Date.now();
                
                // Check if cached response exists and is fresh (< 5 minutes)
                if (cachedResponse) {
                    const cachedTime = cachedResponse.headers.get('sw-cached-time');
                    if (cachedTime) {
                        const age = now - parseInt(cachedTime);
                        if (age < CACHE_DURATION) {
                            // Return cached response if still fresh
                            return cachedResponse;
                        }
                    }
                }
                
                // Fetch fresh data
                return fetch(event.request).then((response) => {
                    // Only cache successful responses
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // Clone response to cache
                    const responseToCache = response.clone();
                    
                    // Add cache timestamp header
                    const headers = new Headers(responseToCache.headers);
                    headers.set('sw-cached-time', now.toString());
                    
                    // Create new response with timestamp
                    const cachedResponse = new Response(responseToCache.body, {
                        status: responseToCache.status,
                        statusText: responseToCache.statusText,
                        headers: headers
                    });
                    
                    // Cache the response
                    cache.put(event.request, cachedResponse);
                    
                    return response;
                }).catch(() => {
                    // If fetch fails and we have cached data, return it even if stale
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                });
            });
        })
    );
});

