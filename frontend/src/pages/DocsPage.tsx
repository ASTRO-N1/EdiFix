import Navbar from '../components/landing/Navbar'
import { motion } from 'framer-motion'
import { useState } from 'react'

// Code snippet component
function CodeSnippet({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  
  return (
    <div style={{ position: 'relative', marginBottom: 24 }}>
      <pre style={{
        background: '#0D0D1A', color: '#4ECDC4', padding: '16px', paddingRight: '100px', 
        borderRadius: '10px 12px 10px 11px / 11px 10px 12px 10px',
        fontFamily: 'JetBrains Mono, monospace', fontSize: 13, overflowX: 'auto', 
        border: '2px solid #1A1A2E', margin: 0, lineHeight: 1.6
      }}>
        {code}
      </pre>
      <button 
        onClick={() => {
          navigator.clipboard.writeText(code)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }}
        style={{
          position: 'absolute', top: 12, right: 12, 
          background: copied ? '#4ECDC4' : 'rgba(78,205,196,0.15)',
          border: '1.5px solid #4ECDC4', borderRadius: 6, 
          color: copied ? '#1A1A2E' : '#4ECDC4',
          fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 11, 
          padding: '4px 10px', cursor: 'pointer', transition: 'all 0.2s'
        }}
      >
        {copied ? '✓ Copied!' : 'Copy'}
      </button>
    </div>
  )
}

export default function DocsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF4' }}>
      <Navbar />
      <div style={{ paddingTop: 120, paddingBottom: 80, paddingLeft: 40, paddingRight: 40, maxWidth: 960, margin: '0 auto', fontFamily: 'Nunito, sans-serif' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 style={{ fontWeight: 900, fontSize: 'clamp(32px, 5vw, 48px)', color: '#1A1A2E', marginBottom: 16 }}>
            EdiFix API <span style={{ color: '#4ECDC4' }}>Documentation</span>
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(26,26,46,0.6)', marginBottom: 40, maxWidth: 700, lineHeight: 1.6 }}>
            The EdiFix API allows you to programmatically upload and parse complex EDI X12 files (like 835s, 837s) into clean, structured JSON instantly via a simple REST interface.
          </p>

          <div style={{
              background: '#FFFFFF',
              border: '3px solid #1A1A2E',
              borderRadius: '16px 14px 18px 15px / 15px 18px 14px 16px',
              boxShadow: '8px 8px 0px #1A1A2E',
              padding: 'clamp(24px, 5vw, 48px)',
              marginBottom: 40
          }}>
            
            {/* 1. Base URL */}
            <h2 style={{ fontWeight: 800, fontSize: 24, marginBottom: 12, color: '#1A1A2E' }}>Base URL</h2>
            <p style={{ fontSize: 16, color: 'rgba(26,26,46,0.7)', marginBottom: 16 }}>All API requests should be routed to our production base URL:</p>
            <CodeSnippet code="https://api.edifix.app/v1" />

            <div style={{ height: 1, background: 'rgba(26,26,46,0.1)', margin: '40px 0' }} />

            {/* 2. Authentication */}
            <h2 style={{ fontWeight: 800, fontSize: 24, marginBottom: 12, color: '#1A1A2E' }}>Authentication</h2>
            <p style={{ fontSize: 16, color: 'rgba(26,26,46,0.7)', lineHeight: 1.6, marginBottom: 16 }}>
              The EdiFix API uses API keys to authenticate requests. You can view and manage your API keys in the <a href="/developer" style={{ color: '#4ECDC4', fontWeight: 700, textDecoration: 'none' }}>Developer Dashboard</a>.
            </p>
            <p style={{ fontSize: 16, color: 'rgba(26,26,46,0.7)', lineHeight: 1.6, marginBottom: 16 }}>
              Your API keys carry many privileges, so be sure to keep them secure! Do not share your secret API keys in publicly accessible areas such as GitHub, client-side code, and so forth.
            </p>
            <p style={{ fontSize: 16, color: 'rgba(26,26,46,0.7)', lineHeight: 1.6, marginBottom: 16 }}>
              Authentication is performed via the HTTP <code>Authorization</code> header using the Bearer protocol.
            </p>
            <CodeSnippet code="Authorization: Bearer sk_live_your_api_key_here" />

            <div style={{ height: 1, background: 'rgba(26,26,46,0.1)', margin: '40px 0' }} />

            {/* 3. Parse Endpoint */}
            <h2 style={{ fontWeight: 800, fontSize: 24, marginBottom: 20, color: '#1A1A2E', display: 'flex', alignItems: 'center' }}>
              <span style={{ 
                display: 'inline-block', background: '#FFE66D', border: '2px solid #1A1A2E', 
                padding: '4px 10px', borderRadius: 8, marginRight: 12, fontSize: 14, 
                transform: 'rotate(-2deg)', boxShadow: '2px 2px 0 #1A1A2E' 
              }}>POST</span>
              /parse
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(26,26,46,0.7)', lineHeight: 1.6, marginBottom: 24 }}>
              The parse endpoint expects a <code>multipart/form-data</code> POST request containing the raw EDI text file. Our engine auto-detects standard X12 transaction sets (835, 837) based on the ISA envelope and applies the appropriate decoding logic.
            </p>

            <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>Request Parameters</h3>
            <div style={{ overflowX: 'auto', marginBottom: 24 }}>
              <table style={{ width: '100%', minWidth: 500, borderCollapse: 'collapse', fontSize: 15, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(26,26,46,0.1)' }}>
                    <th style={{ padding: '12px 8px', fontWeight: 800, color: '#1A1A2E' }}>Parameter</th>
                    <th style={{ padding: '12px 8px', fontWeight: 800, color: '#1A1A2E' }}>Type</th>
                    <th style={{ padding: '12px 8px', fontWeight: 800, color: '#1A1A2E' }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(26,26,46,0.05)' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 700, color: '#FF6B6B' }}>
                      file <span style={{ color: 'rgba(26,26,46,0.4)', fontSize: 12, fontWeight: 600, marginLeft: 4 }}>required</span>
                    </td>
                    <td style={{ padding: '12px 8px', fontFamily: 'JetBrains Mono, monospace', fontSize: 14 }}>File</td>
                    <td style={{ padding: '12px 8px', color: 'rgba(26,26,46,0.7)' }}>The raw EDI file object (supported: .edi, .txt, .dat, .x12). Maximum file size allowed is 10MB.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>Code Examples</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0 24px', marginBottom: 12 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 8 }}>cURL</p>
                <CodeSnippet code={`curl -X POST https://api.edifix.app/v1/parse \\
  -H "Authorization: Bearer sk_live_your_key" \\
  -F "file=@/path/to/claim.edi"`} />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 8 }}>Python (Requests)</p>
                <CodeSnippet code={`import requests

with open("claim.edi", "rb") as f:
    resp = requests.post(
        "https://api.edifix.app/v1/parse",
        headers={"Authorization": "Bearer sk_..."},
        files={"file": f}
    )
print(resp.json())`} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0 24px', marginBottom: 24 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 8 }}>Node.js (Axios)</p>
                <CodeSnippet code={`const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const form = new FormData();
form.append('file', fs.createReadStream('claim.edi'));

const response = await axios.post('https://api.edifix.app/v1/parse', form, {
  headers: {
    ...form.getHeaders(),
    'Authorization': 'Bearer sk_live_your_key'
  }
});`} />
              </div>
            </div>

            <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>Response Object</h3>
            <p style={{ fontSize: 16, color: 'rgba(26,26,46,0.7)', lineHeight: 1.6, marginBottom: 16 }}>
              A successful parse returns a heavily nested JSON object representing the exact EDI envelope and loop hierarchy. The top-level <code>success</code> boolean indicates if the parser successfully completed operations.
            </p>
            <CodeSnippet code={`{
  "success": true,
  "transaction_type": "835",
  "data": {
    "interchange": {
      "sender": "SENDER_ID",
      "receiver": "RECEIVER_ID",
      "segment_terminator": "~",
      "element_separator": "*"
    },
    "transactions": [
      {
        "st_control_number": "0001",
        "loops": {
          "1000A": { ...payer_details },
          "2000": [
            {
               "2100": { ...claim_details },
               "2110": [ { ...service_lines } ]
            }
          ]
        }
      }
    ]
  },
  "errors": []
}`} />

            <div style={{ height: 1, background: 'rgba(26,26,46,0.1)', margin: '40px 0' }} />

            {/* 4. Errors */}
            <h2 style={{ fontWeight: 800, fontSize: 24, marginBottom: 12, color: '#1A1A2E' }}>Errors & Rate Limiting</h2>
            <p style={{ fontSize: 16, color: 'rgba(26,26,46,0.7)', lineHeight: 1.6, marginBottom: 16 }}>
              EdiFix uses conventional HTTP response codes to indicate the success or failure of an API request. Look at the <code>errors</code> array in the response body for human-readable specifics on validation failures.
            </p>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 500, borderCollapse: 'collapse', fontSize: 15, textAlign: 'left' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(26,26,46,0.05)' }}>
                    <td style={{ padding: '16px 8px', fontWeight: 800, color: '#4ECDC4', width: '150px' }}>200 - OK</td>
                    <td style={{ padding: '16px 8px', color: 'rgba(26,26,46,0.7)', lineHeight: 1.5 }}>Everything worked as expected. Check the <code>errors</code> array for any non-fatal data validation issues (e.g. invalid date formats).</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(26,26,46,0.05)' }}>
                    <td style={{ padding: '16px 8px', fontWeight: 800, color: '#FF6B6B' }}>400 - Bad Request</td>
                    <td style={{ padding: '16px 8px', color: 'rgba(26,26,46,0.7)', lineHeight: 1.5 }}>The file was unreadable, not a valid X12 EDI format, or missing required critical envelopes (ISA/GS) preventing the parser from reading it.</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(26,26,46,0.05)' }}>
                    <td style={{ padding: '16px 8px', fontWeight: 800, color: '#FF6B6B' }}>401 - Unauthorized</td>
                    <td style={{ padding: '16px 8px', color: 'rgba(26,26,46,0.7)', lineHeight: 1.5 }}>No valid API key provided or key has been revoked.</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(26,26,46,0.05)' }}>
                    <td style={{ padding: '16px 8px', fontWeight: 800, color: '#FF6B6B' }}>429 - Too Many Requests</td>
                    <td style={{ padding: '16px 8px', color: 'rgba(26,26,46,0.7)', lineHeight: 1.5 }}>Your account has hit the rate limit constraint. Wait before retrying.</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '16px 8px', fontWeight: 800, color: '#FF6B6B' }}>500 - Server Error</td>
                    <td style={{ padding: '16px 8px', color: 'rgba(26,26,46,0.7)', lineHeight: 1.5 }}>Something went seriously wrong on our backend servers.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: 40, marginBottom: 60 }}>
            <p style={{ fontSize: 16, color: 'rgba(26,26,46,0.6)', marginBottom: 20 }}>Ready to integrate?</p>
            <a href="/developer" className="btn-sticker" style={{
                display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 32px', background: '#4ECDC4', color: '#1A1A2E',
                textDecoration: 'none', border: '2.5px solid #1A1A2E', borderRadius: '10px 12px 10px 11px / 11px 10px 12px 10px', 
                fontSize: 16, fontWeight: 800, boxShadow: '4px 4px 0 #1A1A2E', transform: 'rotate(-0.5deg)', transition: 'all 0.15s ease'
            }}>
              Generate Your API Key →
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
