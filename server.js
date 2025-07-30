// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios'); // <--- NEW: Import Axios
require('dotenv').config();    // Load environment variables from .env file

const app = express();
const PORT = process.env.PORT || 3002; // Use port 3002, or whatever your hosting environment provides

// --- CORS Configuration for your React App ---
const corsOptions = {
  origin: process.env.REACT_APP_ORIGIN || 'http://localhost:3000', // Allow your React app's origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allow these HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow these headers from your React app
};
app.use(cors(corsOptions));
console.log(`CORS configured for origin: ${corsOptions.origin}`);

// Middleware to parse JSON request bodies
app.use(express.json());
console.log('JSON body parser middleware enabled');

// --- Proxy Endpoint for Apps Script ---
app.post('/api/apps-script', async (req, res) => {
  console.log('Received request to /api/apps-script');
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);

  const appsScriptUrl = process.env.APPS_SCRIPT_WEB_APP_URL;
  console.log('Apps Script URL from env:', appsScriptUrl);

  if (!appsScriptUrl) {
    console.error("APPS_SCRIPT_WEB_APP_URL is not set in environment variables.");
    return res.status(500).json({ success: false, message: 'Server configuration error: Apps Script URL missing.' });
  }

  try {
    const headersToAppsScript = {
      'Content-Type': 'application/json',
      // Forward the Authorization header (containing the Google Access Token) if present
    };

    if (req.headers.authorization) {
      headersToAppsScript['Authorization'] = req.headers.authorization;
      console.log('Forwarding Authorization header to Apps Script');
    } else {
      console.log('No Authorization header found in request');
    }

    console.log('Headers to send to Apps Script:', headersToAppsScript);

    // --- NEW: Use Axios to make the request to Apps Script ---
    const appsScriptResponse = await axios({
      method: 'post', // Axios uses string for method
      url: appsScriptUrl,
      headers: headersToAppsScript,
      data: req.body, // Axios uses 'data' for the request body (for POST, PUT, PATCH)
      validateStatus: (status) => true, // Tell Axios not to throw an error for non-2xx status codes
                                        // so we can handle them manually
    });

    console.log(`Apps Script responded with status: ${appsScriptResponse.status}`);
    console.log('Apps Script response data:', appsScriptResponse.data);

    // Handle Apps Script response (check status manually because of validateStatus)
    if (appsScriptResponse.status < 200 || appsScriptResponse.status >= 300) {
      console.error(`Apps Script responded with error status ${appsScriptResponse.status}:`, appsScriptResponse.data);
      // Forward the Apps Script's status and response data to the client
      return res.status(appsScriptResponse.status).json({
        success: false,
        message: `Apps Script Error: ${JSON.stringify(appsScriptResponse.data)}`, // Data might already be parsed JSON
        statusCode: appsScriptResponse.status
      });
    }

    // Send Apps Script's response data back to the client (React app)
    // Axios response data is usually already parsed if Content-Type is JSON
    console.log('Forwarding Apps Script response to client');
    res.json(appsScriptResponse.data);

  } catch (error) {
    console.error('Proxy server error during Apps Script communication:', error.message);
    if (error.response) {
        console.error('Error Response Data:', error.response.data);
        console.error('Error Response Status:', error.response.status);
        console.error('Error Response Headers:', error.response.headers);
        res.status(error.response.status || 500).json({
            success: false,
            message: 'Proxy server internal error forwarding request to Apps Script (Axios response error).',
            details: error.response.data || error.message,
            statusCode: error.response.status
        });
    } else if (error.request) {
        console.error('Error Request:', error.request);
        res.status(500).json({
            success: false,
            message: 'Proxy server internal error forwarding request to Apps Script (No response from Apps Script).',
            details: error.message
        });
    } else {
        res.status(500).json({
            success: false,
            message: 'Proxy server internal error.',
            details: error.message
        });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}`);
  console.log(`React app should call http://localhost:${PORT}/api/apps-script (or your deployed proxy URL)`);
});
