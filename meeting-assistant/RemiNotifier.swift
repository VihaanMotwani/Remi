import Cocoa
import SwiftUI

// Custom banner window
class BannerWindow: NSWindow {
    init(message: String) {
        let screen = NSScreen.main!
        let windowWidth: CGFloat = 400
        let windowHeight: CGFloat = 80
        let xPos = (screen.frame.width - windowWidth) / 2
        let yPos = screen.frame.height - windowHeight - 50  // Moved down from 10 to 50
        
        let frame = NSRect(x: xPos, y: yPos, width: windowWidth, height: windowHeight)
        
        super.init(
            contentRect: frame,
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        
        self.isOpaque = false
        self.backgroundColor = .clear
        self.level = .statusBar
        self.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        
        let contentView = NSHostingView(rootView: BannerView(message: message, window: self))
        self.contentView = contentView
        
        self.makeKeyAndOrderFront(nil)
        
        // Auto-dismiss after 5 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
            self.close()
            NSApp.terminate(nil)
        }
    }
}

// SwiftUI Banner View
struct BannerView: View {
    let message: String
    let window: NSWindow
    @State private var isVisible = false
    @State private var progress: CGFloat = 0.0
    
    var body: some View {
        ZStack(alignment: .leading) {
            // Animated progress bar background
            GeometryReader { geometry in
                Rectangle()
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                Color.purple.opacity(0.3),
                                Color.purple.opacity(0.15)
                            ]),
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: geometry.size.width * progress)
                    .animation(.linear(duration: 5), value: progress)
            }
            .cornerRadius(12)
            
            // Main content
            HStack(spacing: 12) {
                // Microphone icon
                Image(systemName: "mic.fill")
                    .font(.system(size: 24))
                    .foregroundColor(.white)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("Knock-knock, it's Remi")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.white)
                    
                    Text(message)
                        .font(.system(size: 12))
                        .foregroundColor(.white.opacity(0.9))
                }
                
                Spacer()
                
                // Add Remi button (purple)
                Button(action: {
                    // Launch the floating controller
                    let task = Process()
                    task.launchPath = "/usr/bin/open"
                    task.arguments = ["-a", "Terminal", Bundle.main.bundlePath + "/../remi_controller"]
                    
                    // Get the directory where remi_notifier is located
                    let executablePath = Bundle.main.executablePath ?? ""
                    let executableDir = (executablePath as NSString).deletingLastPathComponent
                    let controllerPath = (executableDir as NSString).appendingPathComponent("remi_controller")
                    
                    let controller = Process()
                    controller.executableURL = URL(fileURLWithPath: controllerPath)
                    try? controller.run()
                    
                    // Close the banner
                    window.close()
                    NSApp.terminate(nil)
                }) {
                    Text("Add Remi")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(Color.purple)
                        )
                }
                .buttonStyle(PlainButtonStyle())
                
                // Close button
                Button(action: {
                    window.close()
                    NSApp.terminate(nil)
                }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(.white.opacity(0.7))
                }
                .buttonStyle(PlainButtonStyle())
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.black.opacity(0.85))
                .shadow(color: .black.opacity(0.3), radius: 10, x: 0, y: 5)
        )
        .padding(8)
        .scaleEffect(isVisible ? 1 : 0.8)
        .opacity(isVisible ? 1 : 0)
        .onAppear {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                isVisible = true
            }
            // Start progress animation after appearance
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                progress = 1.0
            }
        }
    }
}

// Main app delegate
class BannerAppDelegate: NSObject, NSApplicationDelegate {
    var window: BannerWindow?
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        let message = CommandLine.arguments.count > 1 ? CommandLine.arguments[1...].joined(separator: " ") : "Unknown app is using your microphone"
        window = BannerWindow(message: message)
    }
}

// Create and run the app
let app = NSApplication.shared
let delegate = BannerAppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
