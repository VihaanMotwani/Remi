"use strict";
/**
 * devices.ts - Audio device enumeration and stream creation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestMicPermission = requestMicPermission;
exports.enumerateAudioDevices = enumerateAudioDevices;
exports.findBlackHoleDevice = findBlackHoleDevice;
exports.isBlackHoleInstalled = isBlackHoleInstalled;
exports.getSystemStream = getSystemStream;
exports.getMicStream = getMicStream;
const BLACKHOLE_PATTERN = /BlackHole|VB-?Cable/i;
let micPermissionGranted = false;
/**
 * Request microphone permission once
 */
async function requestMicPermission() {
    if (micPermissionGranted)
        return true;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        micPermissionGranted = true;
        return true;
    }
    catch (err) {
        console.error('Mic permission denied:', err);
        return false;
    }
}
/**
 * Enumerate all audio input devices
 */
async function enumerateAudioDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({
        deviceId: d.deviceId,
        label: d.label,
        kind: d.kind
    }));
}
/**
 * Find BlackHole/VB-Cable device
 */
async function findBlackHoleDevice() {
    const devices = await enumerateAudioDevices();
    const blackhole = devices.find(d => BLACKHOLE_PATTERN.test(d.label));
    return blackhole || null;
}
/**
 * Check if BlackHole is installed
 */
async function isBlackHoleInstalled() {
    const device = await findBlackHoleDevice();
    return device !== null;
}
/**
 * Get system audio stream via BlackHole
 */
async function getSystemStream() {
    const device = await findBlackHoleDevice();
    if (!device) {
        throw new Error('BlackHole device not found');
    }
    const constraints = {
        audio: {
            deviceId: { exact: device.deviceId },
            sampleRate: 48000,
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
        }
    };
    return await navigator.mediaDevices.getUserMedia(constraints);
}
/**
 * Get microphone stream with processing enabled
 */
async function getMicStream() {
    const constraints = {
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        }
    };
    return await navigator.mediaDevices.getUserMedia(constraints);
}
