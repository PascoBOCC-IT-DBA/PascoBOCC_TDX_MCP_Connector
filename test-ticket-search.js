#!/usr/bin/env node
// Direct test of ticket search tool

import dotenv from 'dotenv';
import { TdxClient } from './dist/tdx-client.js';
import { loadConfig } from './dist/config.js';

dotenv.config();

const config = loadConfig();

console.error('='.repeat(60));
console.error('Direct MCP Tool Test - tdx-ticket-search');
console.error('='.repeat(60));
console.error('');

const client = new TdxClient(config);

const startTime = Date.now();

(async () => {
  try {
    console.error('Calling client.post("/115/tickets/search", {MaxResults: 3})...');
    const tickets = await client.post('/115/tickets/search', { MaxResults: 3 });
    
    const elapsed = Date.now() - startTime;
    console.error('');
    console.error('✅ SUCCESS!');
    console.error(`Got response in ${elapsed}ms`);
    console.error(`Result type: ${typeof tickets}`);
    console.error(`Result preview:`, 
      Array.isArray(tickets) ? `Array with ${tickets.length} items` : 
      typeof tickets === 'object' ? 'Object: ' + JSON.stringify(tickets).substring(0, 100) :
      String(tickets).substring(0, 100));
    
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
