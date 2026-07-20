import { ChildProcess, spawn } from 'child_process';
import path from 'path';

const env = {
  ...process.env,
  ALLOW_MODIFICATIONS: 'false',
  TDX_BASE_URL: 'https://service.pascocountyfl.net/TDXWebApi/api',
  NODE_ENV: 'production'
};

const proc = spawn('node', [path.join(process.cwd(), 'dist', 'index.js')], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env
});

let registered = [];
let skipped = [];

proc.stderr?.on('data', (data) => {
  const msg = data.toString();
  if (msg.includes('Skipped modification tool')) {
    const match = msg.match(/Skipped modification tool: (\w+)/);
    if (match) skipped.push(match[1]);
  }
  if (msg.includes('Enabled modification tool')) {
    const match = msg.match(/Enabled modification tool: (\w+)/);
    if (match) registered.push(match[1]);
  }
  if (msg.includes('MCP Server Ready')) {
    console.log('REGISTERED WRITE TOOLS:', registered.length > 0 ? registered : 'NONE');
    console.log('SKIPPED WRITE TOOLS:', skipped.length > 0 ? skipped : 'NONE');
    proc.kill();
  }
});

proc.on('error', (e) => {
  console.error('Error:', e.message);
  process.exit(1);
});

setTimeout(() => {
  console.error('Timeout waiting for MCP server');
  proc.kill();
  process.exit(1);
}, 15000);
