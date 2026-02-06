import ExpoModulesCore
import AVFoundation
import MediaPlayer

// Event name constant
let onPlaybackStateChanged = "onPlaybackStateChanged"

// Debug logging helper - only prints in DEBUG builds
private func debugLog(_ message: String) {
  #if DEBUG
  print("[BackgroundAudio] \(message)")
  #endif
}

// Separate delegate class since Module can't inherit from NSObject
private class AudioPlayerDelegate: NSObject, AVAudioPlayerDelegate {
  var onDecodeError: ((Error?) -> Void)?

  func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
    debugLog("Delegate: finished playing, success: \(flag)")
  }

  func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
    debugLog("Delegate: DECODE ERROR: \(error?.localizedDescription ?? "unknown")")
    onDecodeError?(error)
  }
}

public class BackgroundAudioModule: Module {
  private var audioPlayer: AVAudioPlayer?
  private var audioDelegate = AudioPlayerDelegate()
  private var playing: Bool = false
  private var interruptionObserver: NSObjectProtocol?
  private var routeChangeObserver: NSObjectProtocol?
  private var currentSoundscape: String = "ocean-waves"  // Default soundscape filename
  private var currentVolume: Float = 0.3  // Persists across player recreation

  public func definition() -> ModuleDefinition {
    Name("BackgroundAudio")

    // Register events that can be sent to JS
    Events(onPlaybackStateChanged)

    OnCreate {
      debugLog("Module created")
      self.setupNotificationHandlers()
      self.setupDelegateCallbacks()
    }

    OnDestroy {
      debugLog("Module destroyed - cleaning up")
      self.cleanupNotificationHandlers()
      self.clearNowPlayingInfo()
    }

    AsyncFunction("play") { (filename: String?) -> Bool in
      // Use provided filename or keep current
      if let newFilename = filename, !newFilename.isEmpty {
        await MainActor.run { self.currentSoundscape = newFilename }
      }
      return try await self.startPlayback()
    }

    AsyncFunction("stop") { () -> Bool in
      return await self.stopPlayback()
    }

    AsyncFunction("setVolume") { (volume: Double) -> Bool in
      await MainActor.run {
        let clampedVolume = Float(max(0, min(1, volume)))
        self.currentVolume = clampedVolume
        self.audioPlayer?.volume = clampedVolume
      }
      return true
    }

    AsyncFunction("isPlaying") { () -> Bool in
      return await MainActor.run {
        return self.playing
      }
    }

    // Change soundscape while playing (or set for next play)
    AsyncFunction("setSoundscape") { (filename: String) -> Bool in
      debugLog("Setting soundscape to: \(filename)")
      await MainActor.run { self.currentSoundscape = filename }

      // If currently playing, restart with new soundscape
      if await MainActor.run(body: { self.playing }) {
        debugLog("Restarting playback with new soundscape")
        _ = await self.stopPlayback()
        return try await self.startPlayback()
      }
      return true
    }

    // Get the current soundscape filename
    AsyncFunction("getCurrentSoundscape") { () async -> String in
      return await MainActor.run { self.currentSoundscape }
    }
  }

  private func setupNotificationHandlers() {
    // Store observer tokens for cleanup in deinit
    interruptionObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.interruptionNotification,
      object: nil,
      queue: .main
    ) { [weak self] notification in
      self?.handleInterruption(notification: notification)
    }

    routeChangeObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.routeChangeNotification,
      object: nil,
      queue: .main
    ) { [weak self] notification in
      self?.handleRouteChange(notification: notification)
    }
  }

  private func setupDelegateCallbacks() {
    audioDelegate.onDecodeError = { [weak self] error in
      Task { @MainActor in
        guard let self = self else { return }
        debugLog("Handling decode error: \(error?.localizedDescription ?? "unknown")")
        self.playing = false
        self.audioPlayer?.stop()
        self.audioPlayer = nil
        self.clearNowPlayingInfo()
        self.sendEvent(onPlaybackStateChanged, [
          "isPlaying": false,
          "reason": "decodeError",
          "error": error?.localizedDescription ?? "Unknown decode error"
        ])
      }
    }
  }

  deinit {
    cleanupNotificationHandlers()
    clearNowPlayingInfo()
  }

  private func cleanupNotificationHandlers() {
    if let observer = interruptionObserver {
      NotificationCenter.default.removeObserver(observer)
      interruptionObserver = nil
    }
    if let observer = routeChangeObserver {
      NotificationCenter.default.removeObserver(observer)
      routeChangeObserver = nil
    }
  }

  private func configureAndActivateAudioSession() throws {
    let session = AVAudioSession.sharedInstance()

    debugLog("Current category: \(session.category.rawValue)")
    debugLog("Current mode: \(session.mode.rawValue)")
    debugLog("Is other audio playing: \(session.isOtherAudioPlaying)")

    try session.setCategory(.playback, mode: .default, options: [])
    try session.setActive(true, options: [])

    debugLog("Audio session activated successfully")
    debugLog("Output routes: \(session.currentRoute.outputs.map { $0.portName })")
  }

  // MARK: - Now Playing Info (Control Center integration)

  private func setupNowPlayingInfo() {
    var nowPlayingInfo = [String: Any]()
    nowPlayingInfo[MPMediaItemPropertyTitle] = "Igloo Signer"
    // Show the current soundscape in Control Center
    let soundscapeName = getSoundscapeDisplayName(currentSoundscape)
    nowPlayingInfo[MPMediaItemPropertyArtist] = soundscapeName
    nowPlayingInfo[MPNowPlayingInfoPropertyIsLiveStream] = true
    nowPlayingInfo[MPNowPlayingInfoPropertyPlaybackRate] = 1.0

    MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo
    debugLog("Now Playing info set")
  }

  /// Convert soundscape filename to human-readable name for Control Center
  private func getSoundscapeDisplayName(_ filename: String) -> String {
    switch filename {
    case "ocean-waves":
      return "Ocean Waves"
    case "rain":
      return "Rain"
    case "forest":
      return "Forest"
    case "white-noise":
      return "White Noise"
    case "campfire":
      return "Campfire"
    case "amazon-jungle":
      return "Amazon Jungle"
    case "ambient-dream":
      return "Ambient Dream"
    case "birds":
      return "Birds"
    case "rain-and-birds":
      return "Rain & Birds"
    case "space-atmosphere":
      return "Space Atmosphere"
    default:
      return "Soundscape"
    }
  }

  private func clearNowPlayingInfo() {
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    debugLog("Now Playing info cleared")
  }

  // MARK: - Interruption & Route Handling

  private func handleInterruption(notification: Notification) {
    guard let userInfo = notification.userInfo,
          let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
      debugLog("Could not parse interruption notification")
      return
    }

    Task { @MainActor in
      switch type {
      case .began:
        debugLog("Interruption BEGAN")
        // Emit event to JS - audio is interrupted
        self.sendEvent(onPlaybackStateChanged, [
          "isPlaying": false,
          "reason": "interrupted"
        ])
      case .ended:
        debugLog("Interruption ENDED")
        if self.playing {
          debugLog("Attempting to resume playback...")
          do {
            try AVAudioSession.sharedInstance().setActive(true, options: [])
            let resumed = self.audioPlayer?.play() ?? false
            debugLog("Resume result: \(resumed)")
            if !resumed {
              // Player failed to resume - update state to reflect reality
              debugLog("WARNING: Resume failed, updating playing state to false")
              self.playing = false
              // Emit event to JS - resume failed
              self.sendEvent(onPlaybackStateChanged, [
                "isPlaying": false,
                "reason": "resumeFailed"
              ])
            } else {
              // Emit event to JS - successfully resumed
              self.sendEvent(onPlaybackStateChanged, [
                "isPlaying": true,
                "reason": "resumed",
                "soundscape": self.currentSoundscape
              ])
            }
          } catch {
            debugLog("Failed to resume audio session: \(error)")
            // Audio session activation failed - playback cannot continue
            self.playing = false
            // Emit event to JS - resume failed
            self.sendEvent(onPlaybackStateChanged, [
              "isPlaying": false,
              "reason": "resumeFailed"
            ])
          }
        }
      @unknown default:
        debugLog("Unknown interruption type")
      }
    }
  }

  private func handleRouteChange(notification: Notification) {
    guard let userInfo = notification.userInfo,
          let reasonValue = userInfo[AVAudioSessionRouteChangeReasonKey] as? UInt,
          let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else {
      return
    }

    Task { @MainActor in
      debugLog("Route changed, reason: \(reason.rawValue)")
      let session = AVAudioSession.sharedInstance()
      debugLog("New output routes: \(session.currentRoute.outputs.map { $0.portName })")

      // Resume playback if route changed but we should still be playing
      if self.playing && self.audioPlayer?.isPlaying == false {
        debugLog("Player stopped due to route change, resuming...")
        let resumed = self.audioPlayer?.play() ?? false
        if !resumed {
          debugLog("WARNING: Route change resume failed")
          self.playing = false
          self.sendEvent(onPlaybackStateChanged, [
            "isPlaying": false,
            "reason": "routeChangeFailed"
          ])
        }
      }
    }
  }

  // MARK: - Playback Control

  @MainActor
  private func startPlayback() async throws -> Bool {
    debugLog("========== START PLAYBACK ==========")

    if playing && audioPlayer?.isPlaying == true {
      debugLog("Already playing, skipping")
      return true
    }

    // Step 1: Configure audio session
    debugLog("Step 1: Configuring audio session...")
    do {
      try configureAndActivateAudioSession()
    } catch {
      debugLog("FAILED to configure audio session: \(error)")
      throw error
    }

    // Step 2: Find audio file (now using m4a format)
    debugLog("Step 2: Looking for audio file '\(currentSoundscape).m4a'...")
    var audioPath = Bundle.main.path(forResource: currentSoundscape, ofType: "m4a")

    // Fall back to default 'ocean-waves' if soundscape file not found
    if audioPath == nil && currentSoundscape != "ocean-waves" {
      debugLog("Audio file '\(currentSoundscape).m4a' not found, falling back to 'ocean-waves.m4a'...")
      currentSoundscape = "ocean-waves"
      audioPath = Bundle.main.path(forResource: "ocean-waves", ofType: "m4a")
    }

    guard let finalAudioPath = audioPath else {
      debugLog("FAILED: No audio file found in bundle!")
      debugLog("Bundle path: \(Bundle.main.bundlePath)")
      throw NSError(domain: "BackgroundAudio", code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "Audio file not found"])
    }
    debugLog("Found audio file at: \(finalAudioPath)")

    // Step 3: Create player
    debugLog("Step 3: Creating AVAudioPlayer...")
    do {
      let audioURL = URL(fileURLWithPath: finalAudioPath)
      audioPlayer = try AVAudioPlayer(contentsOf: audioURL)
      audioPlayer?.delegate = audioDelegate
      audioPlayer?.numberOfLoops = -1
      audioPlayer?.volume = currentVolume

      debugLog("Player created successfully")
      debugLog("- Duration: \(audioPlayer?.duration ?? 0) seconds")
      debugLog("- Channels: \(audioPlayer?.numberOfChannels ?? 0)")
    } catch {
      debugLog("FAILED to create player: \(error)")
      throw error
    }

    // Step 4: Prepare to play
    debugLog("Step 4: Preparing to play...")
    let prepared = audioPlayer?.prepareToPlay() ?? false
    debugLog("Prepare result: \(prepared)")

    // Step 5: Start playback
    debugLog("Step 5: Starting playback...")
    let playResult = audioPlayer?.play() ?? false
    debugLog("Play result: \(playResult)")

    if playResult {
      playing = true
      debugLog("Playback started successfully!")
      setupNowPlayingInfo()
      // Emit event to JS - playback started (include actual soundscape in case of fallback)
      self.sendEvent(onPlaybackStateChanged, [
        "isPlaying": true,
        "reason": "started",
        "soundscape": self.currentSoundscape
      ])
    } else {
      debugLog("play() returned false - playback FAILED")
      throw NSError(domain: "BackgroundAudio", code: 2,
                    userInfo: [NSLocalizedDescriptionKey: "play() returned false"])
    }

    debugLog("========== END START PLAYBACK ==========")
    return true
  }

  @MainActor
  private func stopPlayback() async -> Bool {
    debugLog("Stopping playback...")
    clearNowPlayingInfo()
    audioPlayer?.stop()
    audioPlayer = nil
    playing = false

    // Deactivate audio session so other apps (Music, Spotify) can resume
    do {
      try AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
      debugLog("Audio session deactivated")
    } catch {
      debugLog("Failed to deactivate audio session: \(error)")
      // Non-fatal - continue with stop
    }

    // Emit event to JS - playback stopped
    self.sendEvent(onPlaybackStateChanged, [
      "isPlaying": false,
      "reason": "stopped"
    ])

    debugLog("Playback stopped")
    return true
  }
}
