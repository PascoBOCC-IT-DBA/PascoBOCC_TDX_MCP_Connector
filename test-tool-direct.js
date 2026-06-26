#!/usr/bin/env node
// Direct test of MCP tool without HTTP wrapper

import dotenv from 'dotenv';
import { TdxClient } from './dist/tdx-client.js';
import { loadConfig } from './dist/config.js';

dotenv.config();

const config = loadConfig();

console.error('='.repeat(60));
console.error('Direct MCP Tool Test - tdx-statuses-get');
console.error('='.repeat(60));
console.error('');

const client = new TdxClient(config);

const startTime = Date.now();

(async () => {
  try {
    console.error('Calling client.get("/115/statuses")...');
    const statuses = await client.get('/115/statuses');
    
    const elapsed = Date.now() - startTime;
    console.error('');
    console.error('✅ SUCCESS!');
    console.error(`Got response in ${elapsed}ms`);
    console.error(`Result type: ${typeof statuses}`);
    console.error(`Result preview:`, 
      Array.isArray(statuses) ? `Array with ${statuses.length} items` : 
      typeof statuses === 'object' ? 'Object: ' + JSON.stringify(statuses).substring(0, 100) :
      String(statuses).substring(0, 100));
    
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
