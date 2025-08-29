// Configuration for backend URLs
export const config = {
  // For local development
  // BACKEND_URL: 'http://localhost:4000',
  // WS_URL: 'ws://localhost:4000',
  
  // For network testing (mobile devices)
  // BACKEND_URL: 'http://192.168.0.180:4000',
  // WS_URL: 'ws://192.168.0.180:4000',
  
  // For ngrok testing (mobile devices)
  BACKEND_URL: 'http://localhost:4000', // Keep backend on local IP
  WS_URL: 'ws://localhost:4000', // Keep WebSocket on local IP
  
  // For production (when deployed)
  // BACKEND_URL: 'https://your-domain.com',
  // WS_URL: 'wss://your-domain.com',
};

// Function to get the appropriate backend URL based on environment
export function getBackendUrl() {
  // Check if we're running on ngrok
  if (typeof window !== 'undefined' && window.location.hostname.includes('ngrok')) {
    // If frontend is on ngrok, backend should still be on local IP for WebRTC
    return 'http://localhost:4000';
  }
  
  // Default to config
  return config.BACKEND_URL;
}

// Function to get the appropriate WebSocket URL based on environment
export function getWebSocketUrl() {
  // Check if we're running on ngrok
  if (typeof window !== 'undefined' && window.location.hostname.includes('ngrok')) {
    // If frontend is on ngrok, WebSocket should still be on local IP for WebRTC
    return 'ws://localhost:4000';
  }
  
  // Default to config
  return config.WS_URL;
}


// localhost