"use strict";
/**
 * Recorder.tsx - Main UI component for audio capture
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Recorder = void 0;
const react_1 = __importStar(require("react"));
const devices_1 = require("../audio/devices");
const levels_1 = require("../audio/levels");
const presence_1 = require("../meeting/presence");
const uplink_1 = require("../../main/ws/uplink");
const policy_json_1 = __importDefault(require("../../../config/policy.json"));
const { ipcRenderer } = window.require('electron');
const MIME_TYPE = 'audio/webm;codecs=opus';
const CHUNK_INTERVAL = 500; // ms
const Recorder = () => {
    const [hasPermission, setHasPermission] = (0, react_1.useState)(false);
    const [hasBlackHole, setHasBlackHole] = (0, react_1.useState)(false);
    const [showInstallDialog, setShowInstallDialog] = (0, react_1.useState)(false);
    const [isRecording, setIsRecording] = (0, react_1.useState)(false);
    const [consentGiven, setConsentGiven] = (0, react_1.useState)(!policy_json_1.default.requireConsent);
    const [showConsent, setShowConsent] = (0, react_1.useState)(false);
    const [micLevel, setMicLevel] = (0, react_1.useState)(0);
    const [systemLevel, setSystemLevel] = (0, react_1.useState)(0);
    const [meetingState, setMeetingState] = (0, react_1.useState)({
        inMeeting: false,
        evidence: {
            meetingProcessActive: false,
            meetingTabActive: false,
            timestamp: Date.now()
        }
    });
    const [showDebugPanel, setShowDebugPanel] = (0, react_1.useState)(false);
    const [transcriptions, setTranscriptions] = (0, react_1.useState)([]);
    const systemStreamRef = (0, react_1.useRef)(null);
    const micStreamRef = (0, react_1.useRef)(null);
    const systemRecorderRef = (0, react_1.useRef)(null);
    const micRecorderRef = (0, react_1.useRef)(null);
    const systemUplinkRef = (0, react_1.useRef)(null);
    const micUplinkRef = (0, react_1.useRef)(null);
    const presenceDetectorRef = (0, react_1.useRef)(null);
    const cleanupFunctionsRef = (0, react_1.useRef)([]);
    // Store latest RMS values in refs to avoid stale closure issues
    const latestMicRmsRef = (0, react_1.useRef)(0);
    const latestSystemRmsRef = (0, react_1.useRef)(0);
    // Initialize on mount
    (0, react_1.useEffect)(() => {
        // Listen for session token from main process
        const handleToken = (_event, token) => {
            console.log('Received inspector session token');
            (0, presence_1.setInspectorSessionToken)(token);
        };
        ipcRenderer.on('inspector-token', handleToken);
        initializeApp();
        return () => {
            ipcRenderer.removeListener('inspector-token', handleToken);
            cleanup();
        };
    }, []);
    const initializeApp = async () => {
        // Request mic permission
        const granted = await (0, devices_1.requestMicPermission)();
        setHasPermission(granted);
        if (!granted)
            return;
        // Check for BlackHole
        const installed = await (0, devices_1.isBlackHoleInstalled)();
        setHasBlackHole(installed);
        if (!installed && policy_json_1.default.allowSystemCapture) {
            setShowInstallDialog(true);
        }
    };
    const startRecording = async () => {
        if (!hasPermission)
            return;
        if (policy_json_1.default.requireConsent && !consentGiven) {
            setShowConsent(true);
            return;
        }
        try {
            // Initialize presence detector
            presenceDetectorRef.current = new presence_1.PresenceDetector();
            const unsubscribe = presenceDetectorRef.current.subscribe(setMeetingState);
            cleanupFunctionsRef.current.push(unsubscribe);
            // Start polling for meeting detection
            presenceDetectorRef.current.startPolling(2000); // Poll every 2 seconds
            // Start microphone
            await startMicCapture();
            // Start system audio if BlackHole available
            if (hasBlackHole && policy_json_1.default.allowSystemCapture) {
                try {
                    await startSystemCapture();
                }
                catch (err) {
                    console.error('Failed to start system capture:', err);
                }
            }
            setIsRecording(true);
        }
        catch (err) {
            console.error('Failed to start recording:', err);
            cleanup();
        }
    };
    const startMicCapture = async () => {
        const stream = await (0, devices_1.getMicStream)();
        micStreamRef.current = stream;
        // Setup level monitoring
        const cleanupLevel = (0, levels_1.monitorLevel)(stream, (rms) => {
            latestMicRmsRef.current = rms;
            setMicLevel(rms);
        });
        cleanupFunctionsRef.current.push(cleanupLevel);
        // Setup WebSocket uplink
        micUplinkRef.current = new uplink_1.AudioUplink('mic');
        // Handle incoming transcriptions
        micUplinkRef.current.onMessage((message) => {
            setTranscriptions((prev) => [message, ...prev].slice(0, 50)); // Keep last 50
        });
        await micUplinkRef.current.connect();
        // Setup MediaRecorder
        const recorder = new MediaRecorder(stream, {
            mimeType: MIME_TYPE,
            audioBitsPerSecond: 64000
        });
        recorder.ondataavailable = (event) => {
            if (event.data.size > 0 && micUplinkRef.current) {
                micUplinkRef.current.send(event.data);
            }
        };
        recorder.start(CHUNK_INTERVAL);
        micRecorderRef.current = recorder;
    };
    const startSystemCapture = async () => {
        const stream = await (0, devices_1.getSystemStream)();
        systemStreamRef.current = stream;
        // Setup level monitoring
        const cleanupLevel = (0, levels_1.monitorLevel)(stream, (rms) => {
            latestSystemRmsRef.current = rms;
            setSystemLevel(rms);
        });
        cleanupFunctionsRef.current.push(cleanupLevel);
        // Setup WebSocket uplink
        systemUplinkRef.current = new uplink_1.AudioUplink('system');
        // Handle incoming transcriptions
        systemUplinkRef.current.onMessage((message) => {
            setTranscriptions((prev) => [message, ...prev].slice(0, 50)); // Keep last 50
        });
        await systemUplinkRef.current.connect();
        // Setup MediaRecorder
        const recorder = new MediaRecorder(stream, {
            mimeType: MIME_TYPE,
            audioBitsPerSecond: 64000
        });
        recorder.ondataavailable = (event) => {
            if (event.data.size > 0 && systemUplinkRef.current) {
                systemUplinkRef.current.send(event.data);
            }
        };
        recorder.start(CHUNK_INTERVAL);
        systemRecorderRef.current = recorder;
    };
    const stopRecording = () => {
        cleanup();
        setIsRecording(false);
        setMicLevel(0);
        setSystemLevel(0);
        setMeetingState({
            inMeeting: false,
            evidence: {
                meetingProcessActive: false,
                meetingTabActive: false,
                timestamp: Date.now()
            }
        });
        setTranscriptions([]); // Clear transcriptions
    };
    const cleanup = () => {
        // Stop recorders
        if (micRecorderRef.current) {
            micRecorderRef.current.stop();
            micRecorderRef.current = null;
        }
        if (systemRecorderRef.current) {
            systemRecorderRef.current.stop();
            systemRecorderRef.current = null;
        }
        // Stop streams
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach((track) => track.stop());
            micStreamRef.current = null;
        }
        if (systemStreamRef.current) {
            systemStreamRef.current.getTracks().forEach((track) => track.stop());
            systemStreamRef.current = null;
        }
        // Close uplinks
        if (micUplinkRef.current) {
            micUplinkRef.current.close();
            micUplinkRef.current = null;
        }
        if (systemUplinkRef.current) {
            systemUplinkRef.current.close();
            systemUplinkRef.current = null;
        }
        // Reset presence detector
        if (presenceDetectorRef.current) {
            presenceDetectorRef.current.reset();
            presenceDetectorRef.current = null;
        }
        // Run cleanup functions
        cleanupFunctionsRef.current.forEach((fn) => fn());
        cleanupFunctionsRef.current = [];
    };
    const handleConsentAccept = () => {
        setConsentGiven(true);
        setShowConsent(false);
        startRecording();
    };
    return (react_1.default.createElement("div", { style: styles.container },
        react_1.default.createElement("h1", { style: styles.title }, "Tempo Audio Capture"),
        !hasPermission && (react_1.default.createElement("div", { style: { ...styles.card, ...styles.warningCard } },
            react_1.default.createElement("p", null, "\u26A0\uFE0F Microphone permission required"))),
        showInstallDialog && (react_1.default.createElement("div", { style: { ...styles.card, ...styles.infoCard } },
            react_1.default.createElement("h3", { style: styles.cardTitle }, "System Audio Capture"),
            react_1.default.createElement("p", { style: styles.cardText }, "To capture system/meeting audio, install BlackHole 2ch:"),
            react_1.default.createElement("a", { href: "https://github.com/ExistentialAudio/BlackHole", target: "_blank", style: styles.link }, "Download BlackHole"),
            react_1.default.createElement("button", { onClick: () => setShowInstallDialog(false), style: styles.buttonSecondary }, "Dismiss"))),
        showConsent && (react_1.default.createElement("div", { style: styles.modal },
            react_1.default.createElement("div", { style: styles.modalContent },
                react_1.default.createElement("h3", { style: styles.cardTitle }, "Recording Consent"),
                react_1.default.createElement("p", { style: styles.cardText },
                    "This will record audio from your microphone",
                    hasBlackHole && ' and system audio',
                    ". Do you consent?"),
                react_1.default.createElement("div", { style: styles.buttonGroup },
                    react_1.default.createElement("button", { onClick: handleConsentAccept, style: styles.buttonPrimary }, "Accept"),
                    react_1.default.createElement("button", { onClick: () => setShowConsent(false), style: styles.buttonSecondary }, "Decline"))))),
        react_1.default.createElement("div", { style: styles.card },
            !isRecording ? (react_1.default.createElement("button", { onClick: startRecording, disabled: !hasPermission, style: styles.buttonPrimary }, "Start Recording")) : (react_1.default.createElement("button", { onClick: stopRecording, style: { ...styles.buttonPrimary, ...styles.buttonStop } }, "Stop Recording")),
            isRecording && (react_1.default.createElement("div", { style: styles.indicator },
                react_1.default.createElement("div", { style: styles.redDot }),
                react_1.default.createElement("span", null, "Recording")))),
        isRecording && (react_1.default.createElement("div", { style: styles.card },
            react_1.default.createElement("h3", { style: styles.cardTitle }, "Audio Levels"),
            react_1.default.createElement("div", { style: styles.levelRow },
                react_1.default.createElement("span", { style: styles.levelLabel }, "Microphone:"),
                react_1.default.createElement("div", { style: styles.levelBar },
                    react_1.default.createElement("div", { style: {
                            ...styles.levelFill,
                            width: `${Math.min(micLevel * 100, 100)}%`
                        } })),
                react_1.default.createElement("span", { style: styles.levelValue },
                    (micLevel * 100).toFixed(1),
                    "%")),
            hasBlackHole && (react_1.default.createElement("div", { style: styles.levelRow },
                react_1.default.createElement("span", { style: styles.levelLabel }, "System:"),
                react_1.default.createElement("div", { style: styles.levelBar },
                    react_1.default.createElement("div", { style: {
                            ...styles.levelFill,
                            width: `${Math.min(systemLevel * 100, 100)}%`
                        } })),
                react_1.default.createElement("span", { style: styles.levelValue },
                    (systemLevel * 100).toFixed(1),
                    "%"))))),
        isRecording && (react_1.default.createElement("div", { style: styles.card },
            react_1.default.createElement("h3", { style: styles.cardTitle }, "Meeting Status"),
            react_1.default.createElement("div", { style: styles.meetingStatus },
                react_1.default.createElement("div", { style: meetingState.inMeeting ? styles.statusActive : styles.statusInactive }, meetingState.inMeeting ? '🟢 In Meeting' : '⚪ No Meeting'),
                react_1.default.createElement("button", { onClick: () => setShowDebugPanel(!showDebugPanel), style: styles.buttonSecondary },
                    showDebugPanel ? 'Hide' : 'Show',
                    " Debug Info")),
            showDebugPanel && (react_1.default.createElement("div", { style: styles.debugPanel },
                react_1.default.createElement("h4", { style: styles.debugTitle }, "Evidence (for IT troubleshooting)"),
                react_1.default.createElement("pre", { style: styles.debugPre }, JSON.stringify(meetingState.evidence, null, 2)))))),
        isRecording && transcriptions.length > 0 && (react_1.default.createElement("div", { style: styles.card },
            react_1.default.createElement("h3", { style: styles.cardTitle }, "\uD83D\uDCDD Live Transcriptions"),
            react_1.default.createElement("div", { style: styles.transcriptionList }, transcriptions.map((t, idx) => (react_1.default.createElement("div", { key: idx, style: styles.transcriptionItem },
                react_1.default.createElement("div", { style: styles.transcriptionHeader },
                    react_1.default.createElement("span", { style: styles.transcriptionBadge }, t.stream === 'mic' ? '🎤 Mic' : '🔊 System'),
                    react_1.default.createElement("span", { style: styles.transcriptionTime }, t.timestamp)),
                react_1.default.createElement("div", { style: styles.transcriptionText }, t.text))))))),
        react_1.default.createElement("div", { style: styles.card },
            react_1.default.createElement("h3", { style: styles.cardTitle }, "Device Status"),
            react_1.default.createElement("div", { style: styles.statusRow },
                react_1.default.createElement("span", null, "Microphone:"),
                react_1.default.createElement("span", null, hasPermission ? '✅' : '❌')),
            react_1.default.createElement("div", { style: styles.statusRow },
                react_1.default.createElement("span", null, "BlackHole:"),
                react_1.default.createElement("span", null, hasBlackHole ? '✅' : '❌')))));
};
exports.Recorder = Recorder;
const styles = {
    container: {
        padding: '20px',
    },
    title: {
        fontSize: '24px',
        fontWeight: 600,
        marginBottom: '20px',
        color: '#333',
    },
    card: {
        background: 'white',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
    warningCard: {
        background: '#fff3cd',
        borderLeft: '4px solid #ffc107',
    },
    infoCard: {
        background: '#d1ecf1',
        borderLeft: '4px solid #0c5460',
    },
    cardTitle: {
        fontSize: '16px',
        fontWeight: 600,
        marginBottom: '12px',
        color: '#333',
    },
    cardText: {
        fontSize: '14px',
        marginBottom: '12px',
        lineHeight: 1.5,
    },
    buttonPrimary: {
        background: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        padding: '12px 24px',
        fontSize: '16px',
        fontWeight: 600,
        cursor: 'pointer',
        width: '100%',
    },
    buttonStop: {
        background: '#dc3545',
    },
    buttonSecondary: {
        background: '#6c757d',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        padding: '8px 16px',
        fontSize: '14px',
        cursor: 'pointer',
        marginTop: '8px',
    },
    buttonGroup: {
        display: 'flex',
        gap: '12px',
        marginTop: '16px',
    },
    link: {
        color: '#007bff',
        textDecoration: 'none',
        display: 'block',
        marginBottom: '12px',
    },
    indicator: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '12px',
        justifyContent: 'center',
        fontSize: '14px',
        fontWeight: 600,
    },
    redDot: {
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        background: '#dc3545',
        animation: 'pulse 1.5s ease-in-out infinite',
    },
    levelRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '12px',
    },
    levelLabel: {
        fontSize: '14px',
        minWidth: '100px',
    },
    levelBar: {
        flex: 1,
        height: '20px',
        background: '#e9ecef',
        borderRadius: '4px',
        overflow: 'hidden',
    },
    levelFill: {
        height: '100%',
        background: '#28a745',
        transition: 'width 0.1s ease',
    },
    levelValue: {
        fontSize: '12px',
        minWidth: '50px',
        textAlign: 'right',
    },
    meetingStatus: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    statusActive: {
        fontSize: '18px',
        fontWeight: 600,
        color: '#28a745',
    },
    statusInactive: {
        fontSize: '18px',
        fontWeight: 600,
        color: '#6c757d',
    },
    debugPanel: {
        marginTop: '16px',
        padding: '12px',
        background: '#f8f9fa',
        borderRadius: '4px',
        border: '1px solid #dee2e6',
    },
    debugTitle: {
        fontSize: '14px',
        fontWeight: 600,
        marginBottom: '8px',
        color: '#495057',
    },
    debugPre: {
        fontSize: '11px',
        fontFamily: 'Monaco, monospace',
        overflow: 'auto',
        maxHeight: '200px',
        margin: 0,
        color: '#212529',
    },
    statusRow: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: '1px solid #e9ecef',
    },
    transcriptionList: {
        maxHeight: '400px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    transcriptionItem: {
        padding: '12px',
        background: '#f8f9fa',
        borderRadius: '6px',
        borderLeft: '3px solid #007bff',
    },
    transcriptionHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
    },
    transcriptionBadge: {
        fontSize: '12px',
        fontWeight: 600,
        color: '#495057',
    },
    transcriptionTime: {
        fontSize: '12px',
        color: '#6c757d',
    },
    transcriptionText: {
        fontSize: '14px',
        color: '#212529',
        lineHeight: 1.5,
    },
    modal: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    modalContent: {
        background: 'white',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '400px',
        width: '90%',
    },
};
