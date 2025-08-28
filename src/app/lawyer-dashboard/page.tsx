"use client"
import React, { useState, useEffect, useRef } from "react";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, PhoneIncoming, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

interface CallState {
  isIncoming: boolean;
  isConnected: boolean;
  callerId?: string;
  callerEmail?: string;
}

interface ChatMessage {
  sender: string;
  text: string;
  timestamp: string;
}

interface Client {
  id: string;
  email: string;
  role: string;
  status: string;
}

const LawyerDashboard: React.FC = () => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [callState, setCallState] = useState<CallState>({
    isIncoming: false,
    isConnected: false,
  });
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [status, setStatus] = useState<string>("ONLINE");
  const [clients, setClients] = useState<Client[]>([]);
  const [activeChat, setActiveChat] = useState<Client | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("token");
    const userEmail = localStorage.getItem("userEmail");
    const userRole = localStorage.getItem("userRole");

    if (!token || !userEmail || userRole !== "LAWYER") {
      router.push("/login");
      return;
    }

    // Initialize WebSocket connection
    const websocket = new WebSocket("ws://192.168.0.180:4000");
    
    websocket.onopen = () => {
      console.log("WebSocket connected");
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
          // Filter out lawyers, keep only clients for lawyer dashboard
          setClients(data.clients || []);
          break;
        
        case "chat":
          setMessages(prev => [...prev, {
            sender: data.sender || data.senderEmail,
            text: data.message,
            timestamp: data.timestamp
          }]);
          break;
        
        case "incoming-call":
          console.log("Lawyer received incoming call from:", data.callerEmail);
          setCallState({
            isIncoming: true,
            isConnected: false,
            callerId: data.callerId,
            callerEmail: data.callerEmail,
          });
          break;
        
        case "call-accepted":
          setCallState(prev => ({
            ...prev,
            isIncoming: false,
            receiverId: data.receiverId,
            receiverEmail: data.receiverEmail,
          }));
          initializePeerConnection();
          break;
        
        case "call-rejected":
          setCallState({
            isIncoming: false,
            isConnected: false,
          });
          alert("Call was rejected by client");
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

    return () => {
      websocket.close();
    };
  }, [router]);

  const updateStatus = async (newStatus: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://192.168.0.180:4000/lawyers/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        setStatus(newStatus);
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

     // Initialize WebRTC peer connection
   const initializePeerConnection = async () => {
     try {
       console.log("Requesting microphone access...");
       
       // Check if getUserMedia is supported
       if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
         throw new Error("getUserMedia is not supported in this browser");
       }

       // Get user media - VOICE ONLY
       const stream = await navigator.mediaDevices.getUserMedia({
         video: false,
         audio: {
           echoCancellation: true,
           noiseSuppression: true,
           autoGainControl: true
         }
       });
       
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
       peerConnection.ontrack = (event) => {
         setRemoteStream(event.streams[0]);
         setCallState(prev => ({ ...prev, isConnected: true }));
       };

       // Handle ICE candidates
       peerConnection.onicecandidate = (event) => {
         if (event.candidate && ws && callState.callerId) {
           ws.send(JSON.stringify({
             type: "ice-candidate",
             targetId: callState.callerId,
             data: event.candidate
           }));
         }
       };
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

  // Accept incoming call
  const acceptCall = () => {
    if (callState.callerId && ws) {
      console.log("Lawyer accepting call from:", callState.callerId);
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

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userRole");
    router.push("/login");
  };

  const sendMessage = () => {
    if (newMessage.trim() && activeChat && ws) {
      const message = {
        type: "chat",
        receiverId: activeChat.id,
        message: newMessage
      };
      
      console.log("Lawyer sending chat message:", message);
      ws.send(JSON.stringify(message));
      
      setMessages(prev => [...prev, {
        sender: user.email,
        text: newMessage,
        timestamp: new Date().toISOString()
      }]);
      setNewMessage("");
    }
  };

  const startChat = (client: Client) => {
    setActiveChat(client);
    setMessages([]);
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
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Lawyer Dashboard</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Status:</span>
              <select
                value={status}
                onChange={(e) => updateStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="ONLINE">ONLINE</option>
                <option value="BUSY">BUSY</option>
              </select>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 flex items-center space-x-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
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
        {callState.isConnected ? (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-center mb-6">
              <div className="bg-blue-100 rounded-full w-32 h-32 mx-auto mb-4 flex items-center justify-center">
                <Phone className="w-16 h-16 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold">Voice Call</h3>
              <p className="text-gray-600">
                {callState.callerEmail || "Client"}
              </p>
              <div className="mt-4">
                <div className="w-4 h-4 rounded-full mx-auto bg-green-500 animate-pulse"></div>
                <p className="text-sm text-gray-500 mt-1">Connected</p>
              </div>
            </div>

            {/* Call Controls */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={toggleMute}
                className={`p-4 rounded-full flex items-center space-x-2 ${
                  isMuted ? "bg-red-500 text-white" : "bg-gray-200 text-gray-700"
                }`}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              <button
                onClick={endCall}
                className="bg-red-500 text-white p-4 rounded-full flex items-center space-x-2 hover:bg-red-600"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>
          </div>
        ) : (
          // Main Dashboard with Chat
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Available Clients */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">Available Clients</h2>
              {clients.length === 0 ? (
                <p className="text-gray-500 text-center">No clients available</p>
              ) : (
                <div className="space-y-2">
                  {clients.map((client) => (
                    <div
                      key={client.id}
                      className="border rounded-lg p-4 flex items-center justify-between"
                    >
                      <div>
                        <h3 className="font-semibold">{client.email}</h3>
                        <p className="text-sm text-gray-500">{client.role}</p>
                      </div>
                      <button
                        onClick={() => startChat(client)}
                        className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                      >
                        Chat
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chat Section */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">Chat</h2>
              {activeChat ? (
                <div className="flex flex-col h-96">
                  <div className="border-b pb-2 mb-4">
                    <h3 className="font-semibold">Chat with {activeChat.email}</h3>
                  </div>
                  
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto mb-4 space-y-2">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`p-2 rounded-lg ${
                          message.sender === user.email
                            ? "bg-blue-100 ml-auto max-w-xs"
                            : "bg-gray-100 mr-auto max-w-xs"
                        }`}
                      >
                        <p className="text-sm">{message.text}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    ))}
                  </div>
                  
                  {/* Message Input */}
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Type a message..."
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                    />
                    <button
                      onClick={sendMessage}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                    >
                      Send
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <p>Select a client to start chatting</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LawyerDashboard;
