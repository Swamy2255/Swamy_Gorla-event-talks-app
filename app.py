import re
import time
import logging
from datetime import datetime
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from flask import Flask, render_template, jsonify, request

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Cache configuration
feed_cache = {
    'updates': [],
    'last_updated': None,
}
CACHE_DURATION_SECS = 600  # 10 minutes

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
NAMESPACES = {'atom': 'http://www.w3.org/2005/Atom'}

def parse_date_to_iso(date_str):
    """
    Attempts to parse date strings like 'June 17, 2026' into ISO format (YYYY-MM-DD)
    for sorting purposes on the frontend/backend.
    """
    try:
        # Standard formats in the feed, e.g. "June 17, 2026"
        dt = datetime.strptime(date_str.strip(), "%B %d, %Y")
        return dt.strftime("%Y-%m-%d")
    except Exception as e:
        logger.warning(f"Could not parse date string: {date_str}. Error: {e}")
        return ""

def clean_text_for_tweet(html_content):
    """
    Strips HTML tags and normalizes whitespace to create a clean string for tweeting.
    """
    if not html_content:
        return ""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Extract text with space separator to avoid word merging
    text = soup.get_text(separator=' ', strip=True)
    
    # Normalize multiple whitespace characters to a single space
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def fetch_and_parse_feed():
    """
    Fetches the BigQuery Atom feed and parses it into a list of structured updates.
    Splits multi-part entries (by <h3> tags) into individual updates.
    """
    logger.info(f"Fetching BigQuery release notes from: {FEED_URL}")
    response = requests.get(FEED_URL, timeout=15)
    response.raise_for_status()
    
    # Parse the Atom XML
    root = ET.fromstring(response.content)
    entries = root.findall('atom:entry', NAMESPACES)
    
    parsed_updates = []
    
    for entry_idx, entry in enumerate(entries):
        # Extract metadata from XML element
        title_elem = entry.find('atom:title', NAMESPACES)
        date_str = title_elem.text if title_elem is not None else "Unknown Date"
        
        updated_elem = entry.find('atom:updated', NAMESPACES)
        updated_iso = updated_elem.text if updated_elem is not None else ""
        
        link_elem = entry.find("atom:link[@rel='alternate']", NAMESPACES)
        alternate_link = link_elem.attrib.get('href') if link_elem is not None else "https://cloud.google.com/bigquery/docs/release-notes"
        
        content_elem = entry.find('atom:content', NAMESPACES)
        content_html = content_elem.text if content_elem is not None else ""
        
        if not content_html:
            continue
            
        # Parse HTML content to extract sub-updates (e.g. Features, Announcements)
        soup = BeautifulSoup(content_html, 'html.parser')
        h3s = soup.find_all('h3')
        
        iso_date = parse_date_to_iso(date_str)
        
        if not h3s:
            # Fallback if no h3 categories are present
            text_content = clean_text_for_tweet(content_html)
            update_id = f"up_{iso_date or 'date'}_{entry_idx}_0"
            parsed_updates.append({
                'id': update_id,
                'date': date_str,
                'iso_date': iso_date,
                'type': 'General',
                'html': content_html,
                'text': text_content,
                'link': alternate_link
            })
            continue
            
        for sub_idx, h3 in enumerate(h3s):
            update_type = h3.get_text(strip=True)
            
            # Find siblings following this <h3> until the next <h3>
            siblings = []
            curr = h3.next_sibling
            while curr and curr.name != 'h3':
                siblings.append(curr)
                curr = curr.next_sibling
                
            # Reconstruct HTML and text
            sibling_html = "".join(str(s) for s in siblings).strip()
            text_content = clean_text_for_tweet(sibling_html)
            
            # Form clean ID
            clean_type = re.sub(r'[^a-zA-Z0-9]', '', update_type)
            update_id = f"up_{iso_date.replace('-', '') or 'date'}_{clean_type.lower()}_{sub_idx}"
            
            # Ensure the alternate link links to the specific date anchor if possible
            date_anchor = date_str.strip().replace(' ', '_').replace(',', '')
            specific_link = f"https://cloud.google.com/bigquery/docs/release-notes#{date_anchor}"
            
            parsed_updates.append({
                'id': update_id,
                'date': date_str,
                'iso_date': iso_date,
                'type': update_type,
                'html': sibling_html,
                'text': text_content,
                'link': specific_link
            })
            
    # Sort updates by date descending (using iso_date)
    parsed_updates.sort(key=lambda x: x['iso_date'], reverse=True)
    return parsed_updates

@app.route('/')
def index():
    """Renders the main dashboard page."""
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    """
    API endpoint that returns the list of release notes.
    Supports ?refresh=true to bypass cache.
    """
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    now = time.time()
    
    # Check if cache is valid and refresh is not forced
    if (not force_refresh and 
            feed_cache['updates'] and 
            feed_cache['last_updated'] and 
            (now - feed_cache['last_updated']) < CACHE_DURATION_SECS):
        logger.info("Serving releases from cache.")
        return jsonify({
            'success': True,
            'source': 'cache',
            'last_updated': datetime.fromtimestamp(feed_cache['last_updated']).isoformat(),
            'count': len(feed_cache['updates']),
            'releases': feed_cache['updates']
        })
        
    try:
        updates = fetch_and_parse_feed()
        feed_cache['updates'] = updates
        feed_cache['last_updated'] = now
        logger.info(f"Cache refreshed. Parsed {len(updates)} updates.")
        
        return jsonify({
            'success': True,
            'source': 'network',
            'last_updated': datetime.fromtimestamp(now).isoformat(),
            'count': len(updates),
            'releases': updates
        })
    except Exception as e:
        logger.error(f"Error fetching or parsing releases: {e}", exc_info=True)
        # If fetch fails but cache has data, fall back to cache and indicate error
        if feed_cache['updates']:
            return jsonify({
                'success': False,
                'error': f"Failed to refresh data: {str(e)}. Displaying cached data.",
                'source': 'cache_fallback',
                'last_updated': datetime.fromtimestamp(feed_cache['last_updated']).isoformat(),
                'count': len(feed_cache['updates']),
                'releases': feed_cache['updates']
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': str(e),
                'releases': []
            }), 500

@app.route('/api/status')
def get_status():
    """Returns status of feed caching and connection info."""
    now = time.time()
    cache_age = (now - feed_cache['last_updated']) if feed_cache['last_updated'] else None
    return jsonify({
        'cache_populated': bool(feed_cache['updates']),
        'cache_age_seconds': cache_age,
        'cache_duration_allowed': CACHE_DURATION_SECS,
        'last_updated': datetime.fromtimestamp(feed_cache['last_updated']).isoformat() if feed_cache['last_updated'] else None,
        'total_updates_cached': len(feed_cache['updates'])
    })

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
