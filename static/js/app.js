// State Management
let allReleases = [];
let filteredReleases = [];
let currentFilter = 'all';
let searchQuery = '';
let selectedReleaseId = null;

// Progress Ring Configuration
const ring = document.getElementById('progressRing');
const circumference = 2 * Math.PI * 10; // r = 10, circumference = ~62.83
if (ring) {
    ring.style.strokeDasharray = `${circumference} ${circumference}`;
    ring.style.strokeDashoffset = circumference;
}

// DOM Elements
const refreshBtn = document.getElementById('refreshBtn');
const refreshIcon = document.getElementById('refreshIcon');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const filterPills = document.getElementById('filterPills');
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const emptyState = document.getElementById('emptyState');
const updatesGrid = document.getElementById('updatesGrid');
const syncStatus = document.getElementById('syncStatus');
const retryBtn = document.getElementById('retryBtn');

// Modal Elements
const tweetModal = document.getElementById('tweetModal');
const tweetTextarea = document.getElementById('tweetTextarea');
const charCount = document.getElementById('charCount');
const tweetWarning = document.getElementById('tweetWarning');
const progressRing = document.getElementById('progressRing');
const shareTweetBtn = document.getElementById('shareTweetBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');

// Toast Element
const toastNotification = document.getElementById('toastNotification');
const toastMessage = document.getElementById('toastMessage');

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    fetchReleases(false);
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    // Refresh release notes
    refreshBtn.addEventListener('click', () => fetchReleases(true));
    retryBtn.addEventListener('click', () => fetchReleases(true));

    // Search input
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        toggleClearSearchButton();
        filterAndRender();
    });

    // Clear search
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        toggleClearSearchButton();
        filterAndRender();
        searchInput.focus();
    });

    // Filter pills
    filterPills.addEventListener('click', (e) => {
        const pill = e.target.closest('.filter-pill');
        if (!pill) return;

        // Toggle active class
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        currentFilter = pill.dataset.type;
        filterAndRender();
    });

    // Modal action buttons
    closeModalBtn.addEventListener('click', closeComposer);
    cancelModalBtn.addEventListener('click', closeComposer);
    
    // Close modal on overlay click
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) closeComposer();
    });

    // Share button
    shareTweetBtn.addEventListener('click', handleTweetPublish);

    // Textarea character count listener
    tweetTextarea.addEventListener('input', updateTweetCharCount);
}

// Show/Hide Clear Search Button
function toggleClearSearchButton() {
    if (searchQuery.length > 0) {
        clearSearchBtn.style.display = 'block';
    } else {
        clearSearchBtn.style.display = 'none';
    }
}

// Fetch Release Notes
async function fetchReleases(forceRefresh = false) {
    showState('loading');
    if (forceRefresh) {
        refreshBtn.disabled = true;
        refreshBtn.classList.add('spinning');
    }

    try {
        const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok && data.success) {
            allReleases = data.releases;
            updateStatusIndicator(data.source, data.last_updated);
            updateFilterCounts();
            filterAndRender();
        } else {
            throw new Error(data.error || 'Failed to retrieve release notes.');
        }
    } catch (err) {
        console.error('Error fetching release notes:', err);
        errorMessage.textContent = err.message || 'Error connecting to the release feed server.';
        showState('error');
    } finally {
        refreshBtn.disabled = false;
        refreshBtn.classList.remove('spinning');
    }
}

// Update Sync Status Indicator
function updateStatusIndicator(source, timestamp) {
    const dot = syncStatus.querySelector('.status-dot');
    const text = syncStatus.querySelector('.status-text');
    
    dot.className = 'status-dot';
    
    const formattedTime = timestamp ? formatTime(new Date(timestamp)) : 'Unknown';

    if (source === 'network') {
        dot.classList.add('green');
        text.innerHTML = `Live Sync &bull; ${formattedTime}`;
    } else if (source === 'cache') {
        dot.classList.add('green');
        text.innerHTML = `Cached &bull; ${formattedTime}`;
    } else if (source === 'cache_fallback') {
        dot.classList.add('orange');
        text.innerHTML = `Cache Fallback (Feed down) &bull; ${formattedTime}`;
    } else {
        dot.classList.add('red');
        text.textContent = 'Disconnected';
    }
}

// Helper to format timestamp
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Show specific display state (loading, error, empty, grid)
function showState(state) {
    loadingState.style.display = state === 'loading' ? 'flex' : 'none';
    errorState.style.display = state === 'error' ? 'flex' : 'none';
    emptyState.style.display = state === 'empty' ? 'flex' : 'none';
    updatesGrid.style.display = state === 'grid' ? 'flex' : 'none';
}

// Calculate and update the count badges in filter pills
function updateFilterCounts() {
    const counts = {
        all: allReleases.length,
        feature: 0,
        announcement: 0,
        changed: 0,
        deprecated: 0
    };

    allReleases.forEach(rel => {
        const type = rel.type.toLowerCase();
        if (type.includes('feature')) {
            counts.feature++;
        } else if (type.includes('announcement')) {
            counts.announcement++;
        } else if (type.includes('change')) {
            counts.changed++;
        } else if (type.includes('deprecat') || type.includes('issue')) {
            counts.deprecated++;
        }
    });

    // Update DOM Badges
    document.getElementById('count-all').textContent = counts.all;
    document.getElementById('count-feature').textContent = counts.feature;
    document.getElementById('count-announcement').textContent = counts.announcement;
    document.getElementById('count-changed').textContent = counts.changed;
    document.getElementById('count-deprecated').textContent = counts.deprecated;
}

// Filter and Render release cards
function filterAndRender() {
    filteredReleases = allReleases.filter(rel => {
        // Apply category filter
        let matchesType = false;
        const type = rel.type.toLowerCase();
        
        if (currentFilter === 'all') {
            matchesType = true;
        } else if (currentFilter === 'feature' && type.includes('feature')) {
            matchesType = true;
        } else if (currentFilter === 'announcement' && type.includes('announcement')) {
            matchesType = true;
        } else if (currentFilter === 'changed' && type.includes('change')) {
            matchesType = true;
        } else if (currentFilter === 'deprecated' && (type.includes('deprecat') || type.includes('issue'))) {
            matchesType = true;
        }

        // Apply search query
        let matchesSearch = true;
        if (searchQuery) {
            const rawText = rel.text.toLowerCase();
            const dateStr = rel.date.toLowerCase();
            matchesSearch = rawText.includes(searchQuery) || dateStr.includes(searchQuery) || type.includes(searchQuery);
        }

        return matchesType && matchesSearch;
    });

    if (filteredReleases.length === 0) {
        showState('empty');
    } else {
        renderGrid();
        showState('grid');
    }
}

// Render the updates grid HTML
function renderGrid() {
    updatesGrid.innerHTML = '';
    
    filteredReleases.forEach(rel => {
        const card = document.createElement('div');
        const typeClass = determineTypeClass(rel.type);
        
        card.className = `update-card ${typeClass}`;
        card.id = rel.id;
        if (selectedReleaseId === rel.id) {
            card.classList.add('selected');
        }

        // Setup double click or select handler
        card.addEventListener('click', (e) => {
            // Ignore click if it's on buttons/links
            if (e.target.closest('button') || e.target.closest('a')) {
                return;
            }
            selectCard(rel.id);
        });

        // Determine icon based on type
        const typeIcon = getTypeIcon(rel.type);

        card.innerHTML = `
            <div class="card-header">
                <div class="card-meta">
                    <span class="type-badge">
                        <i class="${typeIcon}"></i> ${rel.type}
                    </span>
                    <span class="date-text">${rel.date}</span>
                </div>
                <div class="selection-indicator">
                    <i class="fa-solid fa-circle-check"></i>
                </div>
            </div>
            <div class="card-body">
                ${rel.html}
            </div>
            <div class="card-actions">
                <button class="action-btn btn-copy-action" onclick="copyCardText('${rel.id}')" title="Copy clean text to clipboard">
                    <i class="fa-regular fa-copy"></i> Copy Text
                </button>
                <button class="action-btn btn-link-action" onclick="openLink('${rel.link}')" title="View official release documentation">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Docs
                </button>
                <button class="action-btn btn-tweet-action" onclick="openTweetComposer('${rel.id}')" title="Draft a tweet about this update">
                    <i class="fa-brands fa-x-twitter"></i> Tweet
                </button>
            </div>
        `;

        updatesGrid.appendChild(card);
    });
}

// Helpers to match styling classes
function determineTypeClass(type) {
    const t = type.toLowerCase();
    if (t.includes('feature')) return 'feature';
    if (t.includes('announcement')) return 'announcement';
    if (t.includes('change')) return 'changed';
    if (t.includes('deprecat') || t.includes('issue')) return 'deprecated';
    return 'general';
}

function getTypeIcon(type) {
    const t = type.toLowerCase();
    if (t.includes('feature')) return 'fa-solid fa-circle-plus';
    if (t.includes('announcement')) return 'fa-solid fa-bullhorn';
    if (t.includes('change')) return 'fa-solid fa-sliders';
    if (t.includes('deprecat')) return 'fa-solid fa-ban';
    if (t.includes('issue')) return 'fa-solid fa-triangle-exclamation';
    return 'fa-solid fa-circle-info';
}

// Toggle card selection
function selectCard(id) {
    const prevSelected = document.querySelector('.update-card.selected');
    if (prevSelected) {
        prevSelected.classList.remove('selected');
    }

    if (selectedReleaseId === id) {
        selectedReleaseId = null;
    } else {
        selectedReleaseId = id;
        const currentSelected = document.getElementById(id);
        if (currentSelected) {
            currentSelected.classList.add('selected');
        }
    }
}

// Copy Card Plain Text Utility
window.copyCardText = function(id) {
    const rel = allReleases.find(r => r.id === id);
    if (!rel) return;

    // Create a temporary text block to extract all clean content
    const textToCopy = `BigQuery Release Note [${rel.date}] (${rel.type}):\n\n${rel.text}\n\nRead more: ${rel.link}`;

    navigator.clipboard.writeText(textToCopy).then(() => {
        showToast("Text copied to clipboard!");
    }).catch(err => {
        console.error('Could not copy text: ', err);
        showToast("Failed to copy text", "error");
    });
};

// Open URL Link
window.openLink = function(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
};

// Twitter Intent Length Calculator (handles Twitter link-counting rules)
function calculateTweetLength(text) {
    // X/Twitter counts any URL (http:// or https://) as exactly 23 characters
    const urlRegex = /https?:\/\/[^\s]+/g;
    const rawTextWithoutUrls = text.replace(urlRegex, "");
    const urlMatches = text.match(urlRegex) || [];
    
    // Each URL counts as 23 characters, plus length of other characters
    return rawTextWithoutUrls.length + (urlMatches.length * 23);
}

// Open Tweet Modal Composer
window.openTweetComposer = function(id) {
    const rel = allReleases.find(r => r.id === id);
    if (!rel) return;

    // Highlight card when composing tweet
    selectCard(id);

    // Format initial Tweet
    const prefix = `BigQuery [${rel.type}] (${rel.date}): `;
    const suffix = `\n\nDocs: ${rel.link}`;
    
    // Calculate space left for the main description text
    const prefixLen = prefix.length;
    const suffixLen = 2 + 6 + 23; // '\n\n' (2) + 'Docs: ' (6) + 23 (URL weight)
    const maxDescLen = 280 - prefixLen - suffixLen;

    let descText = rel.text;
    if (descText.length > maxDescLen) {
        descText = descText.substring(0, maxDescLen - 3) + '...';
    }

    const fullDraft = `${prefix}${descText}${suffix}`;
    
    tweetTextarea.value = fullDraft;
    tweetModal.classList.add('open');
    
    // Focus textarea
    setTimeout(() => tweetTextarea.focus(), 100);
    
    updateTweetCharCount();
};

// Update Character Count Visuals in Composer
function updateTweetCharCount() {
    const text = tweetTextarea.value;
    const length = calculateTweetLength(text);
    const remaining = 280 - length;
    
    charCount.textContent = remaining;
    
    // Handle Warning Visuals
    if (remaining < 0) {
        charCount.className = 'char-count-text danger';
        tweetWarning.style.display = 'flex';
        shareTweetBtn.disabled = true;
        shareTweetBtn.style.opacity = '0.5';
        shareTweetBtn.style.cursor = 'not-allowed';
    } else if (remaining <= 20) {
        charCount.className = 'char-count-text warning';
        tweetWarning.style.display = 'none';
        shareTweetBtn.disabled = false;
        shareTweetBtn.style.opacity = '1';
        shareTweetBtn.style.cursor = 'pointer';
    } else {
        charCount.className = 'char-count-text';
        tweetWarning.style.display = 'none';
        shareTweetBtn.disabled = false;
        shareTweetBtn.style.opacity = '1';
        shareTweetBtn.style.cursor = 'pointer';
    }

    // Update Progress SVG Ring
    const percentage = Math.min(100, (length / 280) * 100);
    const offset = circumference - (percentage / 100) * circumference;
    progressRing.style.strokeDashoffset = offset;
    
    // Change circle color
    if (remaining < 0) {
        progressRing.style.stroke = '#f4212e'; // Red
    } else if (remaining <= 20) {
        progressRing.style.stroke = '#f59e0b'; // Amber
    } else {
        progressRing.style.stroke = '#1d9bf0'; // Twitter Blue
    }
}

// Close Modal Composer
function closeComposer() {
    tweetModal.classList.remove('open');
}

// Handle Tweet Publishing (via Web Intent)
function handleTweetPublish() {
    const text = tweetTextarea.value;
    const length = calculateTweetLength(text);
    
    if (length > 280) {
        showToast("Cannot publish: text exceeds 280 characters", "error");
        return;
    }
    
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(intentUrl, '_blank', 'noopener,noreferrer');
    closeComposer();
    showToast("Opening Twitter / X share window!");
}

// Show custom toast notification
function showToast(message, type = 'success') {
    toastMessage.textContent = message;
    
    toastNotification.className = 'toast-notification';
    if (type === 'error') {
        toastNotification.classList.add('error');
    }
    
    toastNotification.classList.add('show');
    
    setTimeout(() => {
        toastNotification.classList.remove('show');
    }, 3000);
}
