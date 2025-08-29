"use client"
import React, { useState, useEffect, useRef } from "react";
import { User, Send, Phone, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBackendUrl, getWebSocketUrl } from "../config";

interface Lawyer {
  id: string;
  email: string;
  role: string;
  status: string;
}

interface ChatMessage {
  sender: string;
  text: string;
  timestamp: string;
}

const Dashboard: React.FC = () => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [activeChat, setActiveChat] = useState<Lawyer | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [status, setStatus] = useState<string>("");

  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("token");
    const userEmail = localStorage.getItem("userEmail");
    const userRole = localStorage.getItem("userRole");

    if (!token || !userEmail) {
      router.push("/login");
      return;
    }

    setUser({ email: userEmail, role: userRole });

    // Initialize WebSocket connection
    const websocket = new WebSocket(getWebSocketUrl());
    
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
          setLawyers(data.lawyers);
          break;
        
        case "chat":
          setMessages(prev => [...prev, {
            sender: data.sender || data.senderEmail,
            text: data.message,
            timestamp: data.timestamp
          }]);
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

  const updateStatus = async (newStatus: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${getBackendUrl()}/lawyers/status`, {
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

  const handleSendMessage = () => {
    if (newMessage.trim() && activeChat && ws) {
      const message = {
        type: "chat",
        receiverId: activeChat.id,
        message: newMessage
      };

      console.log("Sending chat message:", message);
      ws.send(JSON.stringify(message));

      setMessages(prev => [...prev, {
        sender: "You",
        text: newMessage,
        timestamp: new Date().toISOString()
      }]);
      setNewMessage("");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userRole");
    router.push("/login");
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center space-x-4">
          {user?.role === "LAWYER" && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Status:</span>
              <select
                value={status}
                onChange={(e) => updateStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
              >
                <option value="ONLINE">ONLINE</option>
                <option value="BUSY">BUSY</option>
              </select>
            </div>
          )}
          <Link
            href="/call"
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center space-x-2"
          >
            <Phone className="w-4 h-4" />
            <span>Start Video Call</span>
          </Link>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 flex items-center space-x-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Left side: Lawyers List */}
        <div className="w-1/3 pr-4">
          <h2 className="text-xl font-bold mb-6">Available Lawyers</h2>
          {lawyers.length === 0 ? (
            <p className="text-gray-500">No lawyers available</p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {lawyers.map((lawyer) => (
                <div
                  key={lawyer.id}
                  className={`bg-white rounded-2xl shadow-md p-4 flex items-center justify-between cursor-pointer ${
                    activeChat?.id === lawyer.id ? "border-2 border-blue-500" : ""
                  }`}
                  onClick={() => {
                    setActiveChat(lawyer);
                    setMessages([]);
                  }}
                >
                  <div className="flex items-center space-x-3">
                    <User className="w-8 h-8 text-blue-600" />
                    <div>
                      <p className="font-semibold">{lawyer.email}</p>
                      <span className={`text-xs px-2 py-1 rounded ${
                        lawyer.status === "ONLINE" ? "bg-green-100 text-green-800" : 
                        lawyer.status === "BUSY" ? "bg-red-100 text-red-800" : 
                        "bg-gray-100 text-gray-800"
                      }`}>
                        {lawyer.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Link
                      href="/call"
                      className="bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 text-sm"
                    >
                      Call
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right side: Chat Section */}
        <div className="w-2/3 bg-white rounded-2xl shadow-md p-6 flex flex-col">
          {activeChat ? (
            <>
              <h2 className="text-xl font-bold mb-4">
                Chat with {activeChat.email}
              </h2>

              <div className="flex-1 overflow-y-auto border rounded-lg p-4 mb-4 max-h-96">
                {messages.length === 0 ? (
                  <p className="text-gray-500 text-center">No messages yet</p>
                ) : (
                  messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`mb-2 ${
                        msg.sender === "You" ? "text-right" : "text-left"
                      }`}
                    >
                      <div className={`inline-block px-3 py-2 rounded-lg ${
                        msg.sender === "You"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-black"
                      }`}>
                        <div className="text-sm font-semibold">{msg.sender}</div>
                        <div>{msg.text}</div>
                        <div className="text-xs opacity-75">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Type your message..."
                  className="flex-1 border px-3 py-2 rounded-lg"
                />
                <button
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center space-x-2"
                  onClick={handleSendMessage}
                >
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </button>
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-center m-auto">
              Select a lawyer to start chat
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
