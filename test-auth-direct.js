#!/usr/bin/env node
// Direct test of TDX authentication without MCP wrapper

import dotenv from 'dotenv';
import { TdxAuth } from './dist/auth.js';

dotenv.config();

const config = {
  baseUrl: process.env.TDX_BASE_URL,
  beid: process.env.TDX_BEID,
  webServicesKey: process.env.TDX_WEB_SERVICES_KEY,
  appId: parseInt(process.env.TDX_APP_ID),
  assetsAppId: parseInt(process.env.TDX_ASSETS_APP_ID),
  kbAppId: parseInt(process.env.TDX_KB_APP_ID),
};

console.error('='.repeat(60));
console.error('Direct Auth Test');
console.error('='.repeat(60));
console.error('Config:', {
  baseUrl: config.baseUrl,
  beid: config.beid,
  appId: config.appId,
});
console.error('');

const auth = new TdxAuth(config);

console.error('Starting auth test...');
console.error('');

const startTime = Date.now();

(async () => {
  try {
    console.error('Calling getToken()...');
    const token = await auth.getToken();
    
    const elapsed = Date.now() - startTime;
    console.error('');
    console.error('✅ SUCCESS!');
    console.error(`Token obtained in ${elapsed}ms`);
    console.error(`Token length: ${token.length} chars`);
    console.error(`Token preview: ${token.substring(0, 50)}...`);
    
    process.exit(0);
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.error('');
    console.error('❌ FAILED!');
    console.error(`Failed after ${elapsed}ms`);
    console.error(`Error: ${err.message}`);
    if (err.stack) {
      console.error('Stack:', err.stack);
    }
    
    process.exit(1);
  }
})();

// Safety timeout
setTimeout(() => {
  const elapsed = Date.now() - startTime;
  console.error('');
  console.error('⏱️  TEST TIMEOUT - No response after 60 seconds!');
  console.error(`Elapsed: ${elapsed}ms`);
  process.exit(2);
}, 60000);
