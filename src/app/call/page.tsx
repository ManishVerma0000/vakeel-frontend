"use client"
import React, { useState, useEffect, useRef } from "react";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, PhoneCall, PhoneIncoming } from "lucide-react";
import { useRouter } from "next/navigation";
import { getBackendUrl, getWebSocketUrl } from "../config";

interface Lawyer {
  id: string;
  email: string;
  role: string;
  status: string;
}

interface CallState {
  isIncoming: boolean;
  isOutgoing: boolean;
  isConnected: boolean;
  callerId?: string;
  callerEmail?: string;
  receiverId?: string;
  receiverEmail?: string;
}

const CallPage: React.FC = () => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [callState, setCallState] = useState<CallState>({
    isIncoming: false,
    isOutgoing: false,
    isConnected: false,
  });
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [user, setUser] = useState<any>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const router = useRouter();


  const [callDuration, setCallDuration] = useState(0);
const callTimerRef = useRef<NodeJS.Timeout | null>(null);

// Add this useEffect for call timer
useEffect(() => {
  if (callState.isConnected) {
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  } else {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setCallDuration(0);
  }
  
  return () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
  };
}, [callState.isConnected]);

// Helper function to format time
const formatCallDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("token");
    const userEmail = localStorage.getItem("userEmail");

    if (!token || !userEmail) {
      router.push("/login");
      return;
    }

    // Initialize WebSocket connection
    const websocket = new WebSocket(getWebSocketUrl());
    
    websocket.onopen = () => {
      console.log("WebSocket connected successfully");
      // Authenticate with JWT token
      websocket.send(JSON.stringify({
        type: "authenticate",
        token: token
      }));
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case "authenticated":
          setIsConnected(true);
          setUser(data.user);
          break;
        
        case "user-list-update":
          setLawyers(data.lawyers);
          break;
        
        case "incoming-call":
          setCallState({
            isIncoming: true,
            isOutgoing: false,
            isConnected: false,
            callerId: data.callerId,
            callerEmail: data.callerEmail,
          });
          break;
        
        case "call-accepted":
  setCallState(prev => ({
    ...prev,
    isIncoming: false,
    isOutgoing: false, // Change from true to false
    isConnected: false, // Will be set to true when WebRTC connects
    receiverId: data.receiverId,
    receiverEmail: data.receiverEmail,
  }));
  // Add delay to ensure state is updated
  setTimeout(() => initializePeerConnection(), 100);
  break;
        
        case "call-rejected":
          setCallState({
            isIncoming: false,
            isOutgoing: false,
            isConnected: false,
          });
          alert("Call was rejected");
          break;
        
        case "call-ended":
          endCall();
          break;
        
        case "offer":
          handleOffer(data);
          break;
        
        case "answer":
          handleAnswer(data);
          break;
        
        case "ice-candidate":
          handleIceCandidate(data);
          break;
        
        case "error":
          console.error("WebSocket error:", data.message);
          break;
      }
    };

    websocket.onclose = () => {
      console.log("WebSocket disconnected");
      setIsConnected(false);
    };

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    setWs(websocket);

    // Fetch initial lawyers list
    fetchLawyers();

    return () => {
      websocket.close();
    };
  }, [router]);

  const fetchLawyers = async () => {
    try {
      const response = await fetch(`${getBackendUrl()}/lawyers`);
      const data = await response.json();
      setLawyers(data.lawyers);
    } catch (error) {
      console.error("Error fetching lawyers:", error);
    }
  };

         // Initialize WebRTC peer connection
    const initializePeerConnection = async () => {
      try {
        console.log("Requesting microphone access...");
        
        // Check if getUserMedia is supported
        if (!navigator.mediaDevices) {
          throw new Error("MediaDevices API is not supported in this browser. Please use a modern browser like Chrome, Firefox, Safari, or Edge.");
        }

        if (!navigator.mediaDevices.getUserMedia) {
          throw new Error("getUserMedia API is not supported in this browser. Please use a modern browser with WebRTC support.");
        }

        // Get user media - VOICE ONLY with fallback
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
       
       console.log("Microphone access granted:", stream.getAudioTracks().length, "audio tracks");
       setLocalStream(stream);

       // Create peer connection
       const peerConnection = new RTCPeerConnection({
         iceServers: [
           { urls: "stun:stun.l.google.com:19302" },
           { urls: "stun:stun1.l.google.com:19302" },
         ],
       });

       peerConnectionRef.current = peerConnection;

       // Add local stream to peer connection
       stream.getTracks().forEach((track) => {
         peerConnection.addTrack(track, stream);
       });

       // Handle remote stream
       // Handle remote stream
peerConnection.ontrack = (event) => {
  console.log("Remote stream received:", event.streams[0]);
  setRemoteStream(event.streams[0]);
  setCallState(prev => ({ 
    ...prev, 
    isConnected: true // This should trigger the call UI
  }));
  
  // Play remote audio
  const remoteAudio = new Audio();
  remoteAudio.srcObject = event.streams[0];
  remoteAudio.play().catch(console.error);
};

       // Handle ICE candidates
       // Handle ICE candidates
peerConnection.onicecandidate = (event) => {
  if (event.candidate && ws) {
    const target = callState.receiverId; // For client, always use receiverId
    if (target) {
      ws.send(JSON.stringify({
        type: "ice-candidate",
        targetId: target,
        data: event.candidate
      }));
    }
  }
};

       // Create and send offer if initiating call
       if (callState.isOutgoing && callState.receiverId) {
         const offer = await peerConnection.createOffer();
         await peerConnection.setLocalDescription(offer);
         
         ws?.send(JSON.stringify({
           type: "offer",
           targetId: callState.receiverId,
           data: offer
         }));
       }
     } catch (error) {
       console.error("Error initializing peer connection:", error);
       
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
       
       alert(errorMessage);
       console.error("Detailed error:", error);
     }
   };

  const handleOffer = async (data: any) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.data));
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      
      ws?.send(JSON.stringify({
        type: "answer",
        targetId: data.fromId,
        data: answer
      }));
    }
  };

  const handleAnswer = async (data: any) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.data));
    }
  };

  const handleIceCandidate = async (data: any) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.data));
    }
  };

  // Start call
  const startCall = (lawyer: Lawyer) => {
    if (ws) {
      console.log("Starting call with lawyer:", lawyer.email);
      setCallState({
        isIncoming: false,
        isOutgoing: true,
        isConnected: false,
        receiverId: lawyer.id,
        receiverEmail: lawyer.email,
      });

      ws.send(JSON.stringify({
        type: "call-request",
        receiverId: lawyer.id,
      }));

      initializePeerConnection();
    }
  };

  // Accept incoming call
  const acceptCall = () => {
    if (callState.callerId && ws) {
      console.log("Accepting call from:", callState.callerId);
      ws.send(JSON.stringify({
        type: "call-accepted",
        callerId: callState.callerId,
      }));
      initializePeerConnection();
    }
  };

  // Reject incoming call
  const rejectCall = () => {
    if (callState.callerId && ws) {
      ws.send(JSON.stringify({
        type: "call-rejected",
        callerId: callState.callerId,
      }));
    }
    setCallState({
      isIncoming: false,
      isOutgoing: false,
      isConnected: false,
    });
  };

  // End call
  const endCall = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    setRemoteStream(null);
    setCallState({
      isIncoming: false,
      isOutgoing: false,
      isConnected: false,
    });

    ws?.send(JSON.stringify({
      type: "call-end"
    }));
  };

  // Toggle mute
  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Connecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
                 <h1 className="text-3xl font-bold text-center mb-8">Voice Call System</h1>
         
         {/* Microphone Test Button */}
         <div className="text-center mb-6">
           <button
             onClick={() => window.open('/test-microphone', '_blank')}
             className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 text-sm"
           >
             🔧 Test Microphone
           </button>
         </div>

        {/* Incoming Call Modal */}
        {callState.isIncoming && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 text-center">
              <PhoneIncoming className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Incoming Call</h2>
              <p className="text-gray-600 mb-6">From: {callState.callerEmail}</p>
              <div className="flex space-x-4 justify-center">
                <button
                  onClick={acceptCall}
                  className="bg-green-500 text-white px-6 py-3 rounded-lg flex items-center space-x-2 hover:bg-green-600"
                >
                  <Phone className="w-4 h-4" />
                  <span>Accept</span>
                </button>
                <button
                  onClick={rejectCall}
                  className="bg-red-500 text-white px-6 py-3 rounded-lg flex items-center space-x-2 hover:bg-red-600"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>Reject</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Call Interface */}
        {callState.isConnected || callState.isOutgoing ? (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-center mb-6">
              <div className="bg-blue-100 rounded-full w-32 h-32 mx-auto mb-4 flex items-center justify-center">
                <Phone className="w-16 h-16 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold">Voice Call</h3>
              <p className="text-gray-600">
                {callState.receiverEmail || callState.callerEmail || "Connecting..."}
              </p>
              <div className="mt-4">
                <div className={`w-4 h-4 rounded-full mx-auto ${callState.isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                <p className="text-sm text-gray-500 mt-1">
                  {callState.isConnected ? 'Connected' : 'Connecting...'}
                </p>
              </div>
            </div>

            {/* Call Controls */}
           {/* Call Controls */}
<div className="flex justify-center space-x-4">
  <button onClick={toggleMute}>...</button>
  <button onClick={endCall}>...</button>
</div>

{/* Hidden audio element for remote stream */}
{remoteStream && (
  <audio
    ref={(audio) => {
      if (audio && remoteStream) {
        audio.srcObject = remoteStream;
        audio.play().catch(console.error);
      }
    }}
    autoPlay
    style={{ display: 'none' }}
  />
)}
          </div>
        ) : (
          // Available Lawyers List
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6">Available Lawyers</h2>
            {lawyers.length === 0 ? (
              <p className="text-gray-500 text-center">No lawyers available</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lawyers.map((lawyer) => (
                  <div
                    key={lawyer.id}
                    className="border rounded-lg p-4 flex items-center justify-between"
                  >
                    <div>
                      <h3 className="font-semibold">{lawyer.email}</h3>
                      <p className="text-sm text-gray-500">{lawyer.role}</p>
                      <span className={`text-xs px-2 py-1 rounded ${
                        lawyer.status === "ONLINE" ? "bg-green-100 text-green-800" : 
                        lawyer.status === "BUSY" ? "bg-red-100 text-red-800" : 
                        "bg-gray-100 text-gray-800"
                      }`}>
                        {lawyer.status}
                      </span>
                    </div>
                    <button
                      onClick={() => startCall(lawyer)}
                      disabled={lawyer.status !== "ONLINE"}
                      className={`p-3 rounded-full flex items-center space-x-2 ${
                        lawyer.status === "ONLINE"
                          ? "bg-blue-500 text-white hover:bg-blue-600"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      <PhoneCall className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CallPage;
