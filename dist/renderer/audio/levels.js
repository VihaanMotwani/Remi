"use strict";
/**
 * levels.ts - RMS level monitoring using Web Audio API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitorLevel = monitorLevel;
const FRAME_SIZE = 2048;
/**
 * Monitor audio level (RMS) from a MediaStream
 */
function monitorLevel(stream, callback) {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = FRAME_SIZE;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    const dataArray = new Float32Array(analyser.fftSize);
    let animationId;
    function computeRMS() {
        analyser.getFloatTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        callback(rms);
        animationId = requestAnimationFrame(computeRMS);
    }
    computeRMS();
    // Return cleanup function
    return () => {
        cancelAnimationFrame(animationId);
        source.disconnect();
        analyser.disconnect();
        audioContext.close();
    };
}
