"use client"
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getBackendUrl, getWebSocketUrl } from "../config";

const TestPage: React.FC = () => {
  const [backendStatus, setBackendStatus] = useState<string>("Checking...");
  const [wsStatus, setWsStatus] = useState<string>("Checking...");
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    // Test backend connection
    fetch(`${getBackendUrl()}/lawyers`)
      .then(response => {
        if (response.ok) {
          setBackendStatus("✅ Connected");
        } else {
          setBackendStatus("❌ Error: " + response.status);
        }
      })
      .catch(error => {
        setBackendStatus("❌ Failed: " + error.message);
      });

    // Get debug info
    fetch(`${getBackendUrl()}/debug`)
      .then(response => response.json())
      .then(data => {
        setDebugInfo(data);
      })
      .catch(error => {
        console.error("Failed to get debug info:", error);
      });

    // Test WebSocket connection
    const ws = new WebSocket(getWebSocketUrl());
    
    ws.onopen = () => {
      setWsStatus("✅ Connected");
    };
    
    ws.onerror = () => {
      setWsStatus("❌ Failed to connect");
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Vakeel Saab - Test Page</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Connection Status</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Backend API:</span>
              <span className={backendStatus.includes("✅") ? "text-green-600" : "text-red-600"}>
                {backendStatus}
              </span>
            </div>
            <div className="flex justify-between">
              <span>WebSocket:</span>
              <span className={wsStatus.includes("✅") ? "text-green-600" : "text-red-600"}>
                {wsStatus}
              </span>
            </div>
                   </div>
       </div>

       {debugInfo && (
         <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
           <h2 className="text-xl font-bold mb-4">Debug Information</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
               <h3 className="font-semibold">Users ({debugInfo.totalUsers})</h3>
               <div className="text-sm space-y-1">
                 {debugInfo.users.map((user: any) => (
                   <div key={user.id} className="flex justify-between">
                     <span>{user.email}</span>
                     <span className={`px-2 py-1 rounded text-xs ${
                       user.status === 'ONLINE' ? 'bg-green-100 text-green-800' : 
                       user.status === 'BUSY' ? 'bg-red-100 text-red-800' : 
                       'bg-gray-100 text-gray-800'
                     }`}>
                       {user.status}
                     </span>
                   </div>
                 ))}
               </div>
             </div>
             <div>
               <h3 className="font-semibold">Sessions ({debugInfo.totalSessions})</h3>
               <div className="text-sm space-y-1">
                 {debugInfo.sessions.map((session: any, index: number) => (
                   <div key={index} className="flex justify-between">
                     <span>User {session.userId}</span>
                     <span className={`px-2 py-1 rounded text-xs ${
                       session.readyState === 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                     }`}>
                       {session.readyState === 1 ? 'OPEN' : 'CLOSED'}
                     </span>
                   </div>
                 ))}
               </div>
             </div>
           </div>
         </div>
       )}

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4">Client Features</h2>
            <ul className="space-y-2">
              <li>✅ Voice-only calls</li>
              <li>✅ Real-time chat with lawyers</li>
              <li>✅ View lawyer availability</li>
              <li>✅ JWT authentication</li>
            </ul>
            <div className="mt-4">
              <Link href="/login" className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
                Login as Client
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4">Lawyer Features</h2>
            <ul className="space-y-2">
              <li>✅ Voice-only calls</li>
              <li>✅ Real-time chat with clients</li>
              <li>✅ Status management (Online/Busy)</li>
              <li>✅ View available clients</li>
            </ul>
            <div className="mt-4">
              <Link href="/login" className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600">
                Login as Lawyer
              </Link>
            </div>
          </div>
        </div>

                 <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
           <h2 className="text-xl font-bold mb-4">Testing Instructions</h2>
           <ol className="list-decimal list-inside space-y-2">
             <li>Open the application on your computer: <span className="font-mono text-blue-600">http://192.168.0.180:3001</span></li>
             <li>Open the application on your mobile device: <span className="font-mono text-blue-600">http://192.168.0.180:3001</span></li>
             <li>Register/login as a CLIENT on one device</li>
             <li>Register/login as a LAWYER on another device</li>
             <li>Test the chat functionality between client and lawyer</li>
             <li>Test the voice call functionality</li>
           </ol>
           
           <div className="mt-4 p-4 bg-blue-50 rounded-lg">
             <h3 className="font-semibold text-blue-800 mb-2">Having microphone issues?</h3>
             <p className="text-blue-700 text-sm mb-3">
               If you're experiencing "Failed to access camera/microphone" errors, test your microphone first:
             </p>
             <Link 
               href="/test-microphone" 
               className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 text-sm"
             >
               Test Microphone
             </Link>
           </div>
         </div>
      </div>
    </div>
  );
};

export default TestPage;
