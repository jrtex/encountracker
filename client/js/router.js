/**
 * Router Module - HTML5 History API routing for single-page application
 *
 * Provides client-side routing with browser history support:
 * - URL pattern matching and parameter extraction
 * - Browser back/forward button support via popstate events
 * - Deep linking support (load app at specific URL)
 * - Authentication-aware routing with redirect support
 * - BASE_URL_PATH support for subdirectory deployments
 */

const Router = (() => {
  // Route definitions: maps URL patterns to page IDs
  const routes = [
    { path: '/login', pageId: 'login-page', requireAuth: false },
    { path: '/register', pageId: 'register-page', requireAuth: false },
    { path: '/', pageId: 'dashboard-page', requireAuth: true },
    { path: '/dashboard', pageId: 'dashboard-page', requireAuth: true },
    { path: '/campaigns', pageId: 'campaigns-page', requireAuth: true },
    { path: '/encounters', pageId: 'encounters-page', requireAuth: true },
    { path: '/encounters/:id', pageId: 'encounter-detail-page', requireAuth: true },
    { path: '/monsters/:id', pageId: 'monster-detail-page', requireAuth: true },
    { path: '/players', pageId: 'players-page', requireAuth: true },
    { path: '/players/:id', pageId: 'player-detail-page', requireAuth: true },
    { path: '/settings', pageId: 'settings-page', requireAuth: true }
  ];

  // Base URL path for subdirectory deployments (e.g., '/app')
  const basePath = window.BASE_URL_PATH || '';

  // Currently active route
  let currentRoute = null;

  /**
   * Converts route pattern to regex and extracts parameter names
   * Example: '/encounters/:id' -> { regex: /^\/encounters\/([^/]+)$/, params: ['id'] }
   */
  function compileRoute(path) {
    const paramNames = [];
    const regexPattern = path
      .replace(/\//g, '\\/')  // Escape forward slashes
      .replace(/:(\w+)/g, (match, paramName) => {
        paramNames.push(paramName);
        return '([^/]+)';  // Match any characters except forward slash
      });

    return {
      regex: new RegExp(`^${regexPattern}$`),
      paramNames
    };
  }

  // Compile all routes at initialization
  const compiledRoutes = routes.map(route => ({
    ...route,
    ...compileRoute(route.path)
  }));

  /**
   * Strips base path from URL if present
   * Example: '/app/encounters/123' -> '/encounters/123' (if basePath is '/app')
   */
  function stripBasePath(path) {
    if (basePath && path.startsWith(basePath)) {
      return path.substring(basePath.length) || '/';
    }
    return path;
  }

  /**
   * Adds base path to URL if configured
   * Example: '/encounters/123' -> '/app/encounters/123' (if basePath is '/app')
   */
  function addBasePath(path) {
    if (basePath) {
      return `${basePath}${path}`;
    }
    return path;
  }

  /**
   * Matches URL path against route patterns and extracts parameters
   * Returns: { route, params } or null if no match
   */
  function matchRoute(path) {
    // Strip base path and query string
    const cleanPath = stripBasePath(path.split('?')[0]);

    for (const route of compiledRoutes) {
      const match = cleanPath.match(route.regex);
      if (match) {
        // Extract parameter values from regex capture groups
        const params = {};
        route.paramNames.forEach((name, index) => {
          params[name] = match[index + 1];
        });

        return { route, params };
      }
    }

    return null;
  }

  /**
   * Navigates to a URL and updates browser history
   *
   * @param {string} path - URL path to navigate to (e.g., '/encounters/123')
   * @param {object} options - Navigation options
   * @param {boolean} options.replaceHistory - Use replaceState instead of pushState
   * @param {boolean} options.skipHandler - Don't trigger route handler (used internally)
   */
  function navigate(path, options = {}) {
    const { replaceHistory = false, skipHandler = false } = options;

    // Add base path to URL
    const fullPath = addBasePath(path);

    // Update browser history
    if (replaceHistory) {
      window.history.replaceState({}, '', fullPath);
    } else {
      window.history.pushState({}, '', fullPath);
    }

    // Handle route if not skipped
    if (!skipHandler) {
      handleRoute(path);
    }
  }

  /**
   * Handles routing for a given URL path
   * - Matches path against routes
   * - Checks authentication requirements
   * - Sets dataset properties from URL params
   * - Calls App.showPage() to display the page
   *
   * @param {string} path - URL path to route (without base path)
   */
  function handleRoute(path) {
    // Parse query string
    const [pathname, queryString] = path.split('?');
    const queryParams = new URLSearchParams(queryString || '');

    // Match route
    const match = matchRoute(pathname);

    if (!match) {
      // Route not found - redirect to dashboard or login
      console.warn(`Route not found: ${pathname}`);
      if (Auth.isAuthenticated()) {
        navigate('/dashboard', { replaceHistory: true });
      } else {
        navigate('/login', { replaceHistory: true });
      }
      return;
    }

    const { route, params } = match;
    currentRoute = { ...route, params, queryParams };

    // Check authentication
    if (route.requireAuth && !Auth.isAuthenticated()) {
      // Save intended destination and redirect to login
      const redirectUrl = queryString ? `${pathname}?${queryString}` : pathname;
      navigate(`/login?redirect=${encodeURIComponent(redirectUrl)}`, { replaceHistory: true });
      return;
    }

    // Handle login/register when already authenticated
    if (!route.requireAuth && Auth.isAuthenticated() && (route.pageId === 'login-page' || route.pageId === 'register-page')) {
      navigate('/dashboard', { replaceHistory: true });
      return;
    }

    // Set dataset properties for detail pages before showing page
    setDatasetFromParams(route.pageId, params);

    // Handle login/register pages specially - they need to hide top bar and sidebar
    if (route.pageId === 'login-page' || route.pageId === 'register-page') {
      // Remove grid layout from app-wrapper for auth pages
      const appWrapper = document.getElementById('app-wrapper');
      if (appWrapper) {
        appWrapper.classList.remove('sidebar-collapsed');
        appWrapper.style.display = 'block';
      }

      // Hide top bar and sidebar
      const topBar = document.getElementById('top-bar');
      const sidebar = document.getElementById('sidebar');
      if (topBar) topBar.classList.add('hidden');
      if (sidebar) sidebar.style.display = 'none';

      // Hide all pages
      document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
      });

      // Show the correct auth page
      const pageToShow = document.getElementById(route.pageId);
      if (pageToShow) {
        pageToShow.classList.add('active');
      }
    } else {
      // Restore grid layout for app pages
      const appWrapper = document.getElementById('app-wrapper');
      if (appWrapper && appWrapper.style.display === 'block') {
        appWrapper.style.display = '';
      }

      // Show the page (this will trigger MutationObserver to initialize)
      App.showPage(route.pageId, { skipRouterUpdate: true });
    }
  }

  /**
   * Sets dataset properties on page elements from URL parameters
   * This ensures detail pages know which entity to load
   */
  function setDatasetFromParams(pageId, params) {
    if (pageId === 'encounter-detail-page' && params.id) {
      const page = document.getElementById('encounter-detail-page');
      if (page) {
        page.dataset.encounterId = params.id;
      }
    } else if (pageId === 'monster-detail-page' && params.id) {
      const page = document.getElementById('monster-detail-page');
      if (page) {
        page.dataset.monsterId = params.id;
      }
    } else if (pageId === 'player-detail-page' && params.id) {
      const page = document.getElementById('player-detail-page');
      if (page) {
        page.dataset.playerId = params.id;
      }
    }
  }

  /**
   * Generates URL for a given page ID and parameters
   * Used by App.showPage() to update URL when navigating
   *
   * @param {string} pageId - Page identifier (e.g., 'encounter-detail-page')
   * @param {object} params - URL parameters (e.g., { id: '123' })
   * @returns {string|null} - URL path or null if page has no route
   */
  function getUrlForPage(pageId, params = {}) {
    // Find route for this page
    const route = routes.find(r => r.pageId === pageId);
    if (!route) {
      return null;
    }

    // Replace parameters in path
    let path = route.path;
    for (const [key, value] of Object.entries(params)) {
      path = path.replace(`:${key}`, value);
    }

    // Check if all parameters were replaced (no remaining :param)
    if (path.includes(':')) {
      console.warn(`Missing parameter for route ${route.path}:`, params);
      return null;
    }

    return path;
  }

  /**
   * Returns current route information
   * @returns {object|null} - { route, params, queryParams } or null
   */
  function getCurrentRoute() {
    return currentRoute;
  }

  /**
   * Initializes router:
   * - Sets up popstate event listener for back/forward buttons
   * - Handles initial page load by routing current URL
   */
  function init() {
    // Handle browser back/forward buttons
    window.addEventListener('popstate', (event) => {
      const path = stripBasePath(window.location.pathname);
      handleRoute(path + window.location.search);
    });

    // Handle initial page load
    const initialPath = stripBasePath(window.location.pathname);
    const initialSearch = window.location.search;

    // Check if there's a redirect query parameter (from login)
    const queryParams = new URLSearchParams(initialSearch);
    const redirectPath = queryParams.get('redirect');

    if (redirectPath) {
      // Redirect to intended destination after login
      navigate(redirectPath, { replaceHistory: true });
    } else {
      // Route to current URL
      handleRoute(initialPath + initialSearch);
    }
  }

  // Public API
  return {
    navigate,
    handleRoute,
    init,
    getCurrentRoute,
    getUrlForPage
  };
})();
