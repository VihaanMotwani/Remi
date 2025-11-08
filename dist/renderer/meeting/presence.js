"use strict";
/**
 * presence.ts - Meeting presence detection via process + window inspection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresenceDetector = void 0;
exports.getMeetingPresence = getMeetingPresence;
exports.setInspectorSessionToken = setInspectorSessionToken;
exports.checkInspectorStatus = checkInspectorStatus;
// Known meeting app bundle IDs
const MEETING_BUNDLES = [
    'us.zoom.xos', // Zoom
    'com.microsoft.teams', // Microsoft Teams
    'com.cisco.webex.meetings', // Webex
    'com.tinyspeck.slackmacgap' // Slack
];
// Meeting URL patterns for browser tabs
const MEETING_URLS = [
    /meet\.google\.com/i,
    /zoom\.us\/j\//i,
    /teams\.microsoft\.com\/.*/i,
    /webex\.com\/meet/i
];
// Browser bundle IDs
const BROWSER_BUNDLES = {
    chrome: 'com.google.Chrome',
    safari: 'com.apple.Safari'
};
/**
 * Process Inspector Client
 * Communicates with native Swift helper on 127.0.0.1:8787
 */
class ProcessInspectorClient {
    constructor() {
        this.baseURL = 'http://127.0.0.1:8787';
        this.sessionToken = null;
    }
    setSessionToken(token) {
        this.sessionToken = token;
    }
    async request(endpoint) {
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                headers: {
                    'X-Session-Token': this.sessionToken || ''
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            return data.success ? data.data : null;
        }
        catch (err) {
            console.warn(`ProcessInspector: ${endpoint} failed:`, err);
            return null;
        }
    }
    async getForegroundApp() {
        const data = await this.request('/foreground');
        return data?.foregroundApp || null;
    }
    async getRunningApps() {
        const data = await this.request('/running');
        return data?.runningApps || [];
    }
    async getActiveChromeTabURL() {
        const data = await this.request('/chrome-tab');
        return data?.chromeTabURL || null;
    }
    async getActiveSafariTabURL() {
        const data = await this.request('/safari-tab');
        return data?.safariTabURL || null;
    }
    async checkStatus() {
        try {
            const response = await fetch(`${this.baseURL}/status`, {
                headers: { 'X-Session-Token': this.sessionToken || '' }
            });
            return response.ok;
        }
        catch {
            return false;
        }
    }
}
const inspector = new ProcessInspectorClient();
/**
 * Get current meeting presence state
 */
async function getMeetingPresence() {
    try {
        // Get running apps and foreground app
        const [runningApps, foregroundApp] = await Promise.all([
            inspector.getRunningApps(),
            inspector.getForegroundApp()
        ]);
        // Check if any meeting app is running
        const meetingProcessActive = runningApps.some(app => MEETING_BUNDLES.includes(app.bundleId));
        // Check if browser has meeting tab open
        let activeURL = null;
        let meetingTabActive = false;
        if (foregroundApp) {
            if (foregroundApp.bundleId === BROWSER_BUNDLES.chrome) {
                activeURL = await inspector.getActiveChromeTabURL();
            }
            else if (foregroundApp.bundleId === BROWSER_BUNDLES.safari) {
                activeURL = await inspector.getActiveSafariTabURL();
            }
            if (activeURL) {
                meetingTabActive = MEETING_URLS.some(pattern => pattern.test(activeURL));
            }
        }
        const evidence = {
            foregroundApp: foregroundApp || undefined,
            activeURL,
            meetingProcessActive,
            meetingTabActive,
            timestamp: Date.now()
        };
        return {
            inMeeting: meetingProcessActive || meetingTabActive,
            evidence,
            usesCalendarContext: false // Stub for future
        };
    }
    catch (err) {
        console.error('getMeetingPresence failed:', err);
        // Fail-safe: return not in meeting
        return {
            inMeeting: false,
            evidence: {
                meetingProcessActive: false,
                meetingTabActive: false,
                timestamp: Date.now()
            },
            usesCalendarContext: false
        };
    }
}
/**
 * Set session token from native helper
 */
function setInspectorSessionToken(token) {
    inspector.setSessionToken(token);
}
/**
 * Check if native helper is running
 */
async function checkInspectorStatus() {
    return await inspector.checkStatus();
}
/**
 * PresenceDetector class with polling support
 */
class PresenceDetector {
    constructor() {
        this.currentState = {
            inMeeting: false,
            evidence: {
                meetingProcessActive: false,
                meetingTabActive: false,
                timestamp: Date.now()
            }
        };
        this.listeners = [];
        this.pollInterval = null;
    }
    /**
     * Start polling for meeting state
     */
    startPolling(intervalMs = 2000) {
        if (this.pollInterval)
            return;
        this.pollInterval = setInterval(async () => {
            const state = await getMeetingPresence();
            if (state.inMeeting !== this.currentState.inMeeting) {
                this.currentState = state;
                console.log(`🟢 Meeting state: ${state.inMeeting ? 'IN MEETING' : 'NO MEETING'}`);
                this.notifyListeners();
            }
        }, intervalMs);
        // Initial check
        this.checkNow();
    }
    async checkNow() {
        const state = await getMeetingPresence();
        if (state.inMeeting !== this.currentState.inMeeting) {
            this.currentState = state;
            this.notifyListeners();
        }
    }
    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }
    getState() {
        return this.currentState;
    }
    reset() {
        this.stopPolling();
        this.currentState = {
            inMeeting: false,
            evidence: {
                meetingProcessActive: false,
                meetingTabActive: false,
                timestamp: Date.now()
            }
        };
        this.notifyListeners();
    }
    notifyListeners() {
        this.listeners.forEach(listener => listener(this.currentState));
    }
}
exports.PresenceDetector = PresenceDetector;
