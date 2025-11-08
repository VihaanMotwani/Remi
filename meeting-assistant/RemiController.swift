import Cocoa
import SwiftUI
import AVFoundation
import ScreenCaptureKit
import Foundation
import Combine

// MARK: - Agenda WebSocket Client
class AgendaWebSocketClient: ObservableObject {
    @Published var prompts: [AgendaPrompt] = []
    @Published var agendaItems: [AgendaItemStatus] = []
    @Published var isConnected = false
    
    private var webSocket: URLSessionWebSocketTask?
    private var cancellables = Set<AnyCancellable>()
    
    struct AgendaPrompt: Identifiable, Codable {
        let id: String
        let type: String
        let message: String
        let relatedItemId: String
        let priority: String
        let createdAt: String
    }
    
    struct AgendaItemStatus: Identifiable, Codable {
        let id: String
        let title: String
        let status: String
        let description: String
    }
    
    func connect() {
        let url = URL(string: "ws://localhost:8765")!
        webSocket = URLSession.shared.webSocketTask(with: url)
        webSocket?.resume()
        isConnected = true
        receiveMessage()
        print("🔌 Connected to agenda tracker")
    }
    
    func receiveMessage() {
        webSocket?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self?.handleMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self?.handleMessage(text)
                    }
                @unknown default:
                    break
                }
                self?.receiveMessage()
            case .failure(let error):
                print("❌ WebSocket error: \(error)")
                self?.isConnected = false
            }
        }
    }
    
    func handleMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String else {
            return
        }
        
        if type == "state_update" || type == "initial_state",
           let stateData = json["data"] as? [String: Any] {
            
            print("📦 Received state update from agenda tracker")
            
            DispatchQueue.main.async {
                // Update prompts
                if let promptsArray = stateData["prompts"] as? [[String: Any]] {
                    print("📬 Found \(promptsArray.count) prompts in state")
                    
                    let newPrompts = promptsArray.compactMap { dict -> AgendaPrompt? in
                        guard let id = dict["id"] as? String,
                              let type = dict["type"] as? String,
                              let message = dict["message"] as? String,
                              let relatedItemId = dict["relatedItemId"] as? String,
                              let priority = dict["priority"] as? String,
                              let createdAt = dict["createdAt"] as? String else {
                            return nil
                        }
                        return AgendaPrompt(
                            id: id,
                            type: type,
                            message: message,
                            relatedItemId: relatedItemId,
                            priority: priority,
                            createdAt: createdAt
                        )
                    }
                    
                    // Only update if prompts actually changed
                    let oldIds = Set(self.prompts.map { $0.id })
                    let newIds = Set(newPrompts.map { $0.id })
                    
                    if oldIds != newIds {
                        print("🔄 Prompts changed! Old: \(oldIds.count), New: \(newIds.count)")
                        self.prompts = newPrompts
                    } else {
                        print("⏭️ Prompts unchanged, skipping update")
                    }
                    
                    print("🎯 Current prompts: \(self.prompts.count)")
                } else {
                    print("⚠️ No prompts array in state data")
                }
                
                // Update agenda items
                if let itemsArray = stateData["items"] as? [[String: Any]] {
                    self.agendaItems = itemsArray.compactMap { dict in
                        guard let id = dict["id"] as? String,
                              let title = dict["title"] as? String,
                              let status = dict["status"] as? String,
                              let description = dict["description"] as? String else {
                            return nil
                        }
                        return AgendaItemStatus(
                            id: id,
                            title: title,
                            status: status,
                            description: description
                        )
                    }
                }
            }
        }
    }
    
    func dismissPrompt(_ promptId: String) {
        let message: [String: Any] = [
            "type": "dismiss_prompt",
            "promptId": promptId
        ]
        
        if let data = try? JSONSerialization.data(withJSONObject: message),
           let text = String(data: data, encoding: .utf8) {
            webSocket?.send(.string(text)) { error in
                if let error = error {
                    print("❌ Failed to dismiss prompt: \(error)")
                }
            }
        }
    }
    
    func disconnect() {
        webSocket?.cancel(with: .goingAway, reason: nil)
        isConnected = false
    }
}

// MARK: - Microphone Manager for real-time audio capture and transcription
class MicrophoneManager: NSObject, ObservableObject {
    @Published var isListening = false
    @Published var audioLevel: Float = 0.0
    @Published var permissionGranted = false
    @Published var captureSystemAudio = false
    
    private var audioEngine: AVAudioEngine?
    private var inputNode: AVAudioInputNode?
    
    // Separate transcription processes for mic and system audio
    private var micTranscriptionProcess: Process?
    private var micTranscriptionPipe: Pipe?
    private var systemTranscriptionProcess: Process?
    private var systemTranscriptionPipe: Pipe?
    
    // System audio capture
    private var screenRecorder: SCStream?
    private var systemAudioFormat: AVAudioFormat?
    
    override init() {
        super.init()
        checkPermission()
    }
    
    func checkPermission() {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized:
            permissionGranted = true
        case .notDetermined:
            permissionGranted = false
        case .denied, .restricted:
            permissionGranted = false
        @unknown default:
            permissionGranted = false
        }
    }
    
    func requestPermissionAndStart(completion: @escaping (Bool) -> Void) {
        AVCaptureDevice.requestAccess(for: .audio) { [weak self] granted in
            DispatchQueue.main.async {
                self?.permissionGranted = granted
                if granted {
                    print("✅ Microphone permission granted")
                    self?.startListening()
                    completion(true)
                } else {
                    print("❌ Microphone permission denied")
                    completion(false)
                }
            }
        }
    }
    
    func startTranscriptionProcess(streamType: String) -> (Process?, Pipe?) {
        // Get the path to the shell wrapper script
        let executablePath = Bundle.main.executablePath ?? ""
        let executableDir = (executablePath as NSString).deletingLastPathComponent
        let scriptPath = (executableDir as NSString).appendingPathComponent("run_transcription.sh")
        
        let pipe = Pipe()
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/bash")
        process.arguments = [scriptPath, streamType]  // Pass stream type as argument
        process.standardInput = pipe
        
        // Capture output
        let outputPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = outputPipe
        
        // Read and print transcription output
        outputPipe.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            if let output = String(data: data, encoding: .utf8), !output.isEmpty {
                print(output, terminator: "")
            }
        }
        
        do {
            try process.run()
            print("🎙️ Started \(streamType) transcription process")
            return (process, pipe)
        } catch {
            print("❌ Failed to start \(streamType) transcription: \(error)")
            return (nil, nil)
        }
    }
    
    func sendAudioToTranscription(_ samples: [Float], pipe: Pipe?) {
        guard let pipe = pipe else { return }
        
        // Convert samples to comma-separated string
        let sampleString = samples.map { String($0) }.joined(separator: ",") + "\n"
        
        if let data = sampleString.data(using: .utf8) {
            do {
                try pipe.fileHandleForWriting.write(contentsOf: data)
            } catch {
                // Silently handle write errors (pipe might be closed)
            }
        }
    }
    
    @available(macOS 12.3, *)
    func startSystemAudioCapture() async {
        do {
            // Check for screen recording permission
            guard CGPreflightScreenCaptureAccess() else {
                print("⚠️ Screen recording permission required for system audio")
                CGRequestScreenCaptureAccess()
                return
            }
            
            // Get available content (windows, displays, apps)
            let availableContent = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
            
            // Create stream configuration for audio only
            let config = SCStreamConfiguration()
            config.capturesAudio = true
            config.sampleRate = 16000  // Match Whisper's expected rate
            config.channelCount = 1
            
            // Create filter to capture all audio
            let filter = SCContentFilter(display: availableContent.displays.first!, excludingWindows: [])
            
            // Create the stream
            let stream = SCStream(filter: filter, configuration: config, delegate: nil)
            
            // Add audio output handler
            try stream.addStreamOutput(self, type: .audio, sampleHandlerQueue: DispatchQueue(label: "audio.capture.queue"))
            
            // Start the stream
            try await stream.startCapture()
            
            self.screenRecorder = stream
            print("🔊 Started system audio capture")
            
        } catch {
            print("❌ Error starting system audio capture: \(error)")
        }
    }
    
    func stopSystemAudioCapture() async {
        guard let recorder = screenRecorder else { return }
        
        do {
            try await recorder.stopCapture()
            screenRecorder = nil
            print("🔇 Stopped system audio capture")
        } catch {
            print("❌ Error stopping system audio: \(error)")
        }
    }
    
    func startListening() {
        guard permissionGranted else {
            print("⚠️ Cannot start listening - permission not granted")
            return
        }
        
        // Start separate transcription processes for mic and system audio
        let (micProc, micPipe) = startTranscriptionProcess(streamType: "mic")
        micTranscriptionProcess = micProc
        micTranscriptionPipe = micPipe
        
        if captureSystemAudio {
            let (sysProc, sysPipe) = startTranscriptionProcess(streamType: "system")
            systemTranscriptionProcess = sysProc
            systemTranscriptionPipe = sysPipe
        }
        
        audioEngine = AVAudioEngine()
        guard let audioEngine = audioEngine else { return }
        
        inputNode = audioEngine.inputNode
        guard let inputNode = inputNode else { return }
        
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        
        // Convert to 16kHz mono for Whisper
        let targetFormat = AVAudioFormat(commonFormat: .pcmFormatFloat32,
                                        sampleRate: 16000,
                                        channels: 1,
                                        interleaved: false)!
        
        let converter = AVAudioConverter(from: recordingFormat, to: targetFormat)
        
        inputNode.installTap(onBus: 0, bufferSize: 4096, format: recordingFormat) { [weak self] buffer, time in
            guard let self = self else { return }
            
            // Calculate audio level (RMS - Root Mean Square)
            let channelData = buffer.floatChannelData?[0]
            let channelDataCount = Int(buffer.frameLength)
            
            var rms: Float = 0.0
            if let channelData = channelData {
                for i in 0..<channelDataCount {
                    let sample = channelData[i]
                    rms += sample * sample
                }
                rms = sqrt(rms / Float(channelDataCount))
            }
            
            DispatchQueue.main.async {
                self.audioLevel = rms
            }
            
            // Convert audio to 16kHz for transcription
            let convertedBuffer = AVAudioPCMBuffer(pcmFormat: targetFormat,
                                                   frameCapacity: AVAudioFrameCount(targetFormat.sampleRate) * buffer.frameLength / AVAudioFrameCount(recordingFormat.sampleRate))!
            
            var error: NSError?
            let inputBlock: AVAudioConverterInputBlock = { inNumPackets, outStatus in
                outStatus.pointee = .haveData
                return buffer
            }
            
            converter?.convert(to: convertedBuffer, error: &error, withInputFrom: inputBlock)
            
            if error == nil, let floatData = convertedBuffer.floatChannelData?[0] {
                let samples = Array(UnsafeBufferPointer(start: floatData, count: Int(convertedBuffer.frameLength)))
                self.sendAudioToTranscription(samples, pipe: self.micTranscriptionPipe)
            }
        }
        
        do {
            try audioEngine.start()
            isListening = true
            print("🎤 Started listening to microphone in real-time")
            
            // Also start system audio capture if enabled
            if captureSystemAudio {
                if #available(macOS 12.3, *) {
                    Task {
                        await startSystemAudioCapture()
                    }
                } else {
                    print("⚠️ System audio capture requires macOS 12.3 or later")
                }
            }
        } catch {
            print("❌ Error starting audio engine: \(error.localizedDescription)")
        }
    }
    
    func stopListening() {
        guard isListening else { return }
        
        inputNode?.removeTap(onBus: 0)
        audioEngine?.stop()
        isListening = false
        
        // Stop system audio capture if running
        if screenRecorder != nil {
            if #available(macOS 12.3, *) {
                Task {
                    await stopSystemAudioCapture()
                }
            }
        }
        
        // Stop both transcription processes
        micTranscriptionPipe?.fileHandleForWriting.closeFile()
        micTranscriptionProcess?.terminate()
        micTranscriptionProcess = nil
        micTranscriptionPipe = nil
        
        systemTranscriptionPipe?.fileHandleForWriting.closeFile()
        systemTranscriptionProcess?.terminate()
        systemTranscriptionProcess = nil
        systemTranscriptionPipe = nil
        
        print("🛑 Stopped listening to microphone")
    }
    
    deinit {
        if isListening {
            inputNode?.removeTap(onBus: 0)
            audioEngine?.stop()
            micTranscriptionPipe?.fileHandleForWriting.closeFile()
            micTranscriptionProcess?.terminate()
            systemTranscriptionPipe?.fileHandleForWriting.closeFile()
            systemTranscriptionProcess?.terminate()
        }
    }
}

// Extension to handle system audio stream
@available(macOS 12.3, *)
extension MicrophoneManager: SCStreamOutput {
    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio else { return }
        
        // Convert CMSampleBuffer to audio data
        guard let blockBuffer = CMSampleBufferGetDataBuffer(sampleBuffer) else { return }
        
        var length: Int = 0
        var dataPointer: UnsafeMutablePointer<Int8>?
        CMBlockBufferGetDataPointer(blockBuffer, atOffset: 0, lengthAtOffsetOut: nil, totalLengthOut: &length, dataPointerOut: &dataPointer)
        
        guard let data = dataPointer else { return }
        
        // Convert to float samples
        let sampleCount = length / MemoryLayout<Float>.size
        let samples = Array(UnsafeBufferPointer(start: UnsafePointer<Float>(OpaquePointer(data)), count: sampleCount))
        
        // Calculate audio level
        var rms: Float = 0.0
        for sample in samples {
            rms += sample * sample
        }
        rms = sqrt(rms / Float(samples.count))
        
        DispatchQueue.main.async {
            self.audioLevel = max(self.audioLevel, rms * 0.5) // Blend with mic audio
        }
        
        // Send to system audio transcription pipe
        sendAudioToTranscription(samples, pipe: systemTranscriptionPipe)
    }
}

// Floating Controller Window
class FloatingControlWindow: NSPanel {
    private var controllerView: ControllerView?
    private var micManager: MicrophoneManager
    
    init(micManager: MicrophoneManager) {
        self.micManager = micManager
        
        let screen = NSScreen.main!
        let windowWidth: CGFloat = 320
        let windowHeight: CGFloat = 180
        let xPos = screen.frame.width - windowWidth - 20  // 20px from right edge
        let yPos = screen.frame.height - windowHeight - 80  // 80px from top
        
        let frame = NSRect(x: xPos, y: yPos, width: windowWidth, height: windowHeight)
        
        super.init(
            contentRect: frame,
            styleMask: [.nonactivatingPanel, .borderless, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        
        self.isOpaque = false
        self.backgroundColor = .clear
        self.level = .floating
        self.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        self.isMovableByWindowBackground = true
        self.hasShadow = true
        
        controllerView = ControllerView(micManager: micManager, window: self)
        let contentView = NSHostingView(rootView: controllerView!)
        self.contentView = contentView
        
        self.makeKeyAndOrderFront(nil)
    }
}

// MARK: - Agenda Prompt Box UI Component
struct AgendaPromptBox: View {
    let prompt: AgendaWebSocketClient.AgendaPrompt
    let onDismiss: () -> Void
    @State private var isVisible = false
    
    var body: some View {
        HStack(spacing: 12) {
            // Priority indicator
            Circle()
                .fill(priorityColor)
                .frame(width: 8, height: 8)
            
            // Message
            VStack(alignment: .leading, spacing: 4) {
                Text(prompt.message)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.white)
                    .lineLimit(3)
                    .fixedSize(horizontal: false, vertical: true)
                
                Text(typeLabel)
                    .font(.system(size: 10))
                    .foregroundColor(.white.opacity(0.6))
            }
            
            Spacer()
            
            // Dismiss button
            Button(action: onDismiss) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 14))
                    .foregroundColor(.white.opacity(0.5))
            }
            .buttonStyle(PlainButtonStyle())
            .help("Dismiss")
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.black.opacity(0.5))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(priorityColor.opacity(0.3), lineWidth: 1)
                )
        )
        .shadow(color: .black.opacity(0.3), radius: 8, x: 0, y: 4)
        .scaleEffect(isVisible ? 1 : 0.8)
        .opacity(isVisible ? 1 : 0)
        .onAppear {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                isVisible = true
            }
        }
    }
    
    var priorityColor: Color {
        switch prompt.priority {
        case "high": return .red.opacity(0.8)
        case "medium": return .yellow.opacity(0.8)
        default: return .green.opacity(0.8)
        }
    }
    
    var typeLabel: String {
        switch prompt.type {
        case "missing": return "Suggestion"
        case "expand": return "Could expand"
        case "off-track": return "Reminder"
        default: return prompt.type
        }
    }
}

// MARK: - SwiftUI Controller View
struct ControllerView: View {
    @ObservedObject var micManager: MicrophoneManager
    @StateObject private var agendaClient = AgendaWebSocketClient()
    let window: NSWindow
    @State private var isVisible = false
    @State private var isDragging = false
    
    var body: some View {
        VStack(spacing: 16) {
            // Header
            HStack {
                // Microphone icon with pulsing animation
                ZStack {
                    if micManager.isListening {
                        Circle()
                            .stroke(Color.green.opacity(0.6), lineWidth: 2)
                            .frame(width: 38, height: 38)
                            .scaleEffect(1 + CGFloat(micManager.audioLevel) * 3)
                            .animation(.easeInOut(duration: 0.1), value: micManager.audioLevel)
                    }
                    
                    Image(systemName: "mic.fill")
                        .font(.system(size: 22))
                        .foregroundColor(micManager.isListening ? .green : .white)
                }
                .frame(width: 40, height: 40)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("Remi Audio Monitor")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.white)
                    
                    Text(micManager.isListening ? "🎤 Listening..." : "Ready to listen")
                        .font(.system(size: 11))
                        .foregroundColor(.white.opacity(0.8))
                }
                
                Spacer()
                
                // Close button
                Button(action: {
                    micManager.stopListening()
                    agendaClient.disconnect()
                    window.close()
                    NSApp.terminate(nil)
                }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 18))
                        .foregroundColor(.white.opacity(0.6))
                }
                .buttonStyle(PlainButtonStyle())
                .help("Close")
            }
            
            Divider()
                .background(Color.white.opacity(0.2))
            
            // Audio level visualization
            VStack(spacing: 8) {
                HStack(spacing: 2) {
                    ForEach(0..<30, id: \.self) { index in
                        RoundedRectangle(cornerRadius: 2)
                            .fill(CGFloat(index) < CGFloat(micManager.audioLevel * 150) ? 
                                  Color.green : Color.white.opacity(0.15))
                            .frame(width: 8, height: 16)
                    }
                }
                
                Text("Audio Level: \(Int(micManager.audioLevel * 100))%")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.white.opacity(0.7))
            }
            
            // System audio toggle
            HStack {
                Toggle(isOn: Binding(
                    get: { micManager.captureSystemAudio },
                    set: { micManager.captureSystemAudio = $0 }
                )) {
                    HStack(spacing: 6) {
                        Image(systemName: "speaker.wave.2.fill")
                            .font(.system(size: 12))
                        Text("Capture System Audio")
                            .font(.system(size: 11, weight: .medium))
                    }
                    .foregroundColor(.white.opacity(0.9))
                }
                .toggleStyle(SwitchToggleStyle(tint: .purple))
                .disabled(micManager.isListening)
            }
            
            // Agenda Prompts Section
            if !agendaClient.prompts.isEmpty {
                Divider()
                    .background(Color.white.opacity(0.2))
                
                VStack(spacing: 8) {
                    HStack {
                        Image(systemName: "lightbulb.fill")
                            .font(.system(size: 12))
                            .foregroundColor(.yellow.opacity(0.8))
                        Text("Agenda Suggestions")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(.white.opacity(0.9))
                        Spacer()
                    }
                    
                    ForEach(Array(agendaClient.prompts.prefix(3)), id: \.id) { prompt in
                        AgendaPromptBox(prompt: prompt) {
                            agendaClient.dismissPrompt(prompt.id)
                        }
                        .transition(.asymmetric(
                            insertion: .scale.combined(with: .opacity),
                            removal: .scale.combined(with: .opacity)
                        ))
                    }
                }
                .padding(.top, 4)
                .animation(.spring(response: 0.4, dampingFraction: 0.7), value: agendaClient.prompts.count)
            }
            
            // Control buttons
            HStack(spacing: 12) {
                Button(action: {
                    if micManager.isListening {
                        micManager.stopListening()
                    } else {
                        if micManager.permissionGranted {
                            micManager.startListening()
                        } else {
                            micManager.requestPermissionAndStart { success in
                                if !success {
                                    // Show alert if permission denied
                                    let alert = NSAlert()
                                    alert.messageText = "Microphone Permission Required"
                                    alert.informativeText = "Please grant microphone access in System Preferences > Security & Privacy > Microphone"
                                    alert.alertStyle = .warning
                                    alert.runModal()
                                }
                            }
                        }
                    }
                }) {
                    HStack {
                        Image(systemName: micManager.isListening ? "stop.circle.fill" : "play.circle.fill")
                            .font(.system(size: 14))
                        Text(micManager.isListening ? "Stop" : "Start")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(micManager.isListening ? Color.red : Color.purple)
                    )
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(
                    Color.black.opacity(0.75)
                        .shadow(.inner(color: Color.white.opacity(0.1), radius: 1, x: 0, y: 1))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.white.opacity(0.15), lineWidth: 1)
                )
        )
        .shadow(color: .black.opacity(0.5), radius: 20, x: 0, y: 10)
        .scaleEffect(isVisible ? 1 : 0.8)
        .opacity(isVisible ? 1 : 0)
        .onAppear {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                isVisible = true
            }
            
            // Connect to agenda tracker WebSocket
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                agendaClient.connect()
            }
        }
        .onDisappear {
            agendaClient.disconnect()
        }
    }
}

// Main app delegate
class ControllerAppDelegate: NSObject, NSApplicationDelegate {
    var window: FloatingControlWindow?
    var micManager = MicrophoneManager()
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        window = FloatingControlWindow(micManager: micManager)
    }
    
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}

// Create and run the app
let app = NSApplication.shared
let delegate = ControllerAppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
