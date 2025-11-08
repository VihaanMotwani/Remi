"use strict";
/**
 * uplink.ts - WebSocket client for streaming audio chunks to backend
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioUplink = void 0;
const WS_BASE_URL = 'ws://127.0.0.1:8765';
const RECONNECT_DELAY = 2000;
const MAX_QUEUE_SIZE = 100;
class AudioUplink {
    constructor(streamType) {
        this.ws = null;
        this.queue = [];
        this.isConnecting = false;
        this.messageCallback = null;
        this.streamType = streamType;
    }
    /**
     * Set callback for incoming messages (e.g., transcriptions)
     */
    onMessage(callback) {
        this.messageCallback = callback;
    }
    /**
     * Connect to WebSocket endpoint
     */
    connect() {
        if (this.ws?.readyState === WebSocket.OPEN) {
            return Promise.resolve();
        }
        if (this.isConnecting) {
            return new Promise((resolve) => {
                const checkConnection = setInterval(() => {
                    if (this.ws?.readyState === WebSocket.OPEN) {
                        clearInterval(checkConnection);
                        resolve();
                    }
                }, 100);
            });
        }
        this.isConnecting = true;
        const url = `${WS_BASE_URL}/${this.streamType}`;
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(url);
            this.ws.onopen = () => {
                this.isConnecting = false;
                this.flushQueue();
                resolve();
            };
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === 'transcription' && this.messageCallback) {
                        this.messageCallback(message);
                    }
                }
                catch (err) {
                    console.error('Failed to parse WebSocket message:', err);
                }
            };
            this.ws.onerror = (err) => {
                console.error(`WS error (${this.streamType}):`, err);
                this.isConnecting = false;
                reject(err);
            };
            this.ws.onclose = () => {
                this.isConnecting = false;
                this.ws = null;
            };
        });
    }
    /**
     * Send audio chunk
     */
    async send(chunk) {
        // Handle backpressure with queue
        if (this.queue.length >= MAX_QUEUE_SIZE) {
            console.warn(`Queue full for ${this.streamType}, dropping oldest chunk`);
            this.queue.shift();
        }
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.queue.push(chunk);
            try {
                await this.connect();
            }
            catch (err) {
                // Connection failed, will retry on next chunk
                return;
            }
            return;
        }
        // Send queued chunks first
        if (this.queue.length > 0) {
            this.flushQueue();
        }
        // Send current chunk
        try {
            const buffer = await chunk.arrayBuffer();
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(buffer);
            }
        }
        catch (err) {
            console.error(`Failed to send chunk (${this.streamType}):`, err);
        }
    }
    /**
     * Flush queued chunks
     */
    async flushQueue() {
        while (this.queue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
            const chunk = this.queue.shift();
            try {
                const buffer = await chunk.arrayBuffer();
                this.ws.send(buffer);
            }
            catch (err) {
                console.error(`Failed to flush chunk (${this.streamType}):`, err);
                break;
            }
        }
    }
    /**
     * Close connection
     */
    close() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.queue = [];
    }
    /**
     * Check if connected
     */
    isConnected() {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}
exports.AudioUplink = AudioUplink;
