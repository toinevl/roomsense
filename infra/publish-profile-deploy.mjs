import fs from 'fs';
import path from 'path';
import https from 'https';

const publishUrl = process.env.MS_DEPLOY_URL || '';
const zipPath = process.env.ZIP_PATH || '';
const username = process.env.ZIP_USER || '';
const password = process.env.ZIP_PASS || '';

if (!publishUrl || !zipPath || !username || !password) {
  console.error('Missing deploy env: MS_DEPLOY_URL, ZIP_PATH, ZIP_USER, ZIP_PASS');
  process.exit(2);
}

const zipBuffer = fs.readFileSync(zipPath);
const fileName = path.basename(zipPath);

const parsed = new URL(publishUrl);
const options = {
  hostname: parsed.hostname,
  port: parsed.port || 443,
  path: parsed.pathname,
  method: 'PUT',
  auth: `${username}:${password}`,
  headers: {
    'Content-Type': 'application/zip',
    'Content-Length': zipBuffer.length,
    Accept: 'application/json',
    'x-ms-deployment-api': 'true'
  }
};

function call(req) {
  const onRes = (res) => {
    console.log(`HTTP ${res.statusCode}`);
    let body = '';
    res.on('data', chunk => { body += chunk; });
    res.on('end', () => {
      const tail = body ? body.slice(-256) : '(empty)';
      console.log(tail);
      process.exit(res.statusCode === 200 || res.statusCode === 202 || res.statusCode === 409 ? 0 : 1);
    });
  };
  const onErr = (err) => {
    console.error('Request error:', err && err.message ? err.message : err);
    process.exit(1);
  };
  req.on('response', onRes);
  req.on('error', onErr);
}

const req = https.request(options, call);
req.on('error', (err) => {
  console.error('Request setup error:', err && err.message ? err.message : err);
  process.exit(1);
});
req.write(zipBuffer);
req.end();
