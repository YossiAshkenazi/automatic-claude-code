// Version selector functionality for Claude Code SDK docs

(function() {
    'use strict';

    // Version configuration
    const versions = [
        { value: 'latest', label: 'Latest (0.1.0)' },
        { value: 'v0.1.0', label: 'v0.1.0' }
    ];

    // Initialize version selector
    function initVersionSelector() {
        const sidebarNav = document.querySelector('.wy-side-nav-search');
        if (!sidebarNav) return;

        // Create version selector container
        const versionContainer = document.createElement('div');
        versionContainer.className = 'version-selector';

        // Create select element
        const select = document.createElement('select');
        select.id = 'version-selector';
        select.setAttribute('aria-label', 'Select documentation version');

        // Add options
        versions.forEach(version => {
            const option = document.createElement('option');
            option.value = version.value;
            option.textContent = version.label;
            select.appendChild(option);
        });

        // Set current version
        const currentPath = window.location.pathname;
        const currentVersion = getCurrentVersion(currentPath);
        select.value = currentVersion;

        // Add change event listener
        select.addEventListener('change', handleVersionChange);

        versionContainer.appendChild(select);
        sidebarNav.appendChild(versionContainer);
    }

    // Get current version from URL
    function getCurrentVersion(path) {
        if (path.includes('/latest/')) return 'latest';
        if (path.includes('/v0.1.0/')) return 'v0.1.0';
        return 'latest'; // default
    }

    // Handle version change
    function handleVersionChange(event) {
        const selectedVersion = event.target.value;
        const currentPath = window.location.pathname;
        const newPath = updatePathForVersion(currentPath, selectedVersion);
        
        if (newPath !== currentPath) {
            window.location.href = newPath;
        }
    }

    // Update URL path for selected version
    function updatePathForVersion(currentPath, version) {
        const basePath = '/automatic-claude-code/python-sdk/';
        
        // Remove existing version from path
        let cleanPath = currentPath.replace(/\/(latest|v[\d.]+)\//g, '/');
        
        // Ensure we start with the base path
        if (!cleanPath.startsWith(basePath)) {
            cleanPath = basePath + cleanPath.replace(/^\/+/, '');
        }
        
        // Add new version
        if (version === 'latest') {
            return cleanPath;
        } else {
            return cleanPath.replace(basePath, basePath + version + '/');
        }
    }

    // Add keyboard navigation
    function addKeyboardNavigation() {
        document.addEventListener('keydown', function(event) {
            // Alt + V to focus version selector
            if (event.altKey && event.key === 'v') {
                event.preventDefault();
                const selector = document.getElementById('version-selector');
                if (selector) {
                    selector.focus();
                }
            }
        });
    }

    // Add version banner for non-latest versions
    function addVersionBanner() {
        const currentPath = window.location.pathname;
        const currentVersion = getCurrentVersion(currentPath);
        
        if (currentVersion !== 'latest') {
            const banner = document.createElement('div');
            banner.className = 'version-banner';
            banner.style.cssText = `
                background-color: #f39c12;
                color: white;
                padding: 10px;
                text-align: center;
                font-weight: bold;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 1000;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            `;
            
            banner.innerHTML = `
                You are viewing documentation for version ${currentVersion}.
                <a href="/automatic-claude-code/python-sdk/" style="color: white; text-decoration: underline; margin-left: 10px;">
                    View latest version
                </a>
            `;
            
            document.body.insertBefore(banner, document.body.firstChild);
            
            // Adjust body top margin
            document.body.style.marginTop = '50px';
        }
    }

    // Analytics for version usage
    function trackVersionUsage() {
        const currentVersion = getCurrentVersion(window.location.pathname);
        
        // Track with Google Analytics if available
        if (typeof gtag !== 'undefined') {
            gtag('event', 'version_view', {
                'custom_parameter': currentVersion
            });
        }
        
        // Track with console for development
        console.info(`Claude Code SDK docs - Version: ${currentVersion}`);
    }

    // Initialize everything when DOM is ready
    function initialize() {
        initVersionSelector();
        addKeyboardNavigation();
        addVersionBanner();
        trackVersionUsage();
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Handle navigation for single-page applications
    window.addEventListener('popstate', function() {
        // Re-initialize on navigation
        setTimeout(initialize, 100);
    });

})();