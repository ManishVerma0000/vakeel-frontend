"use client"
import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Volume2, AlertCircle } from "lucide-react";

const TestMicrophone: React.FC = () => {
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<string>("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check browser compatibility on component mount
  useEffect(() => {
    const checkBrowserSupport = () => {
      const userAgent = navigator.userAgent;
      let browserName = "Unknown";
      
      if (userAgent.includes("Chrome")) browserName = "Chrome";
      else if (userAgent.includes("Firefox")) browserName = "Firefox";
      else if (userAgent.includes("Safari")) browserName = "Safari";
      else if (userAgent.includes("Edge")) browserName = "Edge";
      
      // Legacy getUserMedia polyfill for older browsers
      if (navigator.mediaDevices === undefined) {
        (navigator as any).mediaDevices = {};
      }

      if (navigator.mediaDevices.getUserMedia === undefined) {
        navigator.mediaDevices.getUserMedia = function(constraints) {
          const getUserMedia = (navigator as any).webkitGetUserMedia || (navigator as any).mozGetUserMedia || (navigator as any).msGetUserMedia;
          
          if (!getUserMedia) {
            return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
          }
          
          return new Promise((resolve, reject) => {
            getUserMedia.call(navigator, constraints, resolve, reject);
          });
        }
      }
      
      const hasMediaDevices = !!navigator.mediaDevices;
      const hasGetUserMedia = !!navigator.mediaDevices?.getUserMedia;
      
      setBrowserInfo(`${browserName} - MediaDevices: ${hasMediaDevices} - getUserMedia: ${hasGetUserMedia}`);
    };
    
    checkBrowserSupport();
  }, []);

  const startMicrophoneTest = async () => {
    try {
      setError(null);
      setIsTesting(true);

      console.log("Checking browser support...");
      console.log("navigator.mediaDevices:", !!navigator.mediaDevices);
      console.log("getUserMedia support:", !!navigator.mediaDevices?.getUserMedia);
      console.log("User agent:", navigator.userAgent);

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices) {
        throw new Error("MediaDevices API is not supported in this browser. Please use a modern browser like Chrome, Firefox, Safari, or Edge.");
      }

      if (!navigator.mediaDevices.getUserMedia) {
        throw new Error("getUserMedia API is not supported in this browser. Please use a modern browser with WebRTC support.");
      }

      console.log("Requesting microphone access...");

      // Request microphone access with fallback
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      } catch (mediaError) {
        console.log("Advanced audio constraints failed, trying basic audio...");
        // Fallback to basic audio constraints
        stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true
        });
      }

      streamRef.current = stream;
      console.log("Microphone access granted:", stream.getAudioTracks().length, "audio tracks");

      // Create audio element to play the stream
      if (audioRef.current) {
        audioRef.current.srcObject = stream;
        audioRef.current.play().catch(console.error);
      }

      // Monitor audio levels
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;

      source.connect(analyser);
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateAudioLevel = () => {
        if (!isTesting) return;

        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        setAudioLevel(average);
        requestAnimationFrame(updateAudioLevel);
      };

      updateAudioLevel();

    } catch (error) {
      console.error("Microphone test error:", error);
      
      let errorMessage = "Failed to access microphone";
      
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotAllowedError':
            errorMessage = "Microphone access denied. Please allow microphone access in your browser settings.";
            break;
          case 'NotFoundError':
            errorMessage = "No microphone found. Please check your microphone connection.";
            break;
          case 'NotReadableError':
            errorMessage = "Microphone is already in use by another application.";
            break;
          case 'OverconstrainedError':
            errorMessage = "Microphone doesn't meet the required constraints.";
            break;
          default:
            errorMessage = `Microphone error: ${error.message}`;
        }
      }
      
      setError(errorMessage);
      setIsTesting(false);
    }
  };

  const stopMicrophoneTest = () => {
    setIsTesting(false);
    setAudioLevel(0);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
  };

  const toggleMute = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Microphone Test</h1>
        
                 <div className="bg-white rounded-lg shadow-lg p-6">
           <h2 className="text-xl font-bold mb-4">Test Your Microphone</h2>
           
           {/* Browser Information */}
           <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4">
             <div className="text-sm">
               <strong>Browser Info:</strong> {browserInfo}
             </div>
           </div>
           
           {error && (
             <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex items-center">
               <AlertCircle className="w-5 h-5 mr-2" />
               {error}
             </div>
           )}

           <div className="space-y-4">
            {/* Audio Level Indicator */}
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium">Audio Level:</span>
              <div className="flex-1 bg-gray-200 rounded-full h-4">
                <div 
                  className="bg-green-500 h-4 rounded-full transition-all duration-100"
                  style={{ width: `${(audioLevel / 255) * 100}%` }}
                ></div>
              </div>
              <span className="text-sm text-gray-600 w-12">{Math.round((audioLevel / 255) * 100)}%</span>
            </div>

            {/* Controls */}
            <div className="flex space-x-4">
              {!isTesting ? (
                <button
                  onClick={startMicrophoneTest}
                  className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 flex items-center space-x-2"
                >
                  <Mic className="w-5 h-5" />
                  <span>Start Test</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={stopMicrophoneTest}
                    className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 flex items-center space-x-2"
                  >
                    <MicOff className="w-5 h-5" />
                    <span>Stop Test</span>
                  </button>
                  
                  <button
                    onClick={toggleMute}
                    className={`px-6 py-3 rounded-lg flex items-center space-x-2 ${
                      isMuted 
                        ? "bg-gray-500 text-white hover:bg-gray-600" 
                        : "bg-green-500 text-white hover:bg-green-600"
                    }`}
                  >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    <span>{isMuted ? "Unmute" : "Mute"}</span>
                  </button>
                </>
              )}
            </div>

            {/* Status */}
            <div className="text-sm text-gray-600">
              {isTesting ? (
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Microphone is active. Speak to see audio levels.</span>
                </div>
              ) : (
                <span>Click "Start Test" to begin microphone testing.</span>
              )}
            </div>
          </div>
        </div>

                 {/* Troubleshooting Tips */}
         <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
           <h2 className="text-xl font-bold mb-4">Troubleshooting Tips</h2>
           <ul className="space-y-2 text-sm">
             <li>• <strong>Browser Support:</strong> Use Chrome, Firefox, Safari, or Edge (latest versions)</li>
             <li>• <strong>HTTPS Required:</strong> Microphone access requires HTTPS (except localhost)</li>
             <li>• <strong>Browser Permissions:</strong> Allow microphone access when prompted</li>
             <li>• <strong>Microphone Connection:</strong> Check if your microphone is properly connected</li>
             <li>• <strong>Other Applications:</strong> Close other apps that might be using your microphone</li>
             <li>• <strong>Browser Settings:</strong> Check browser settings for microphone permissions</li>
             <li>• <strong>Mobile Devices:</strong> Ensure microphone permissions are granted in device settings</li>
             <li>• <strong>Corporate Networks:</strong> Some corporate firewalls block microphone access</li>
             <li>• <strong>Browser Extensions:</strong> Disable ad blockers or privacy extensions that might block microphone</li>
           </ul>
         </div>

        {/* Hidden audio element for playback */}
        <audio ref={audioRef} autoPlay muted={isMuted} />
      </div>
    </div>
  );
};

export default TestMicrophone;
