#!/usr/bin/env node
'use strict';

const OLD_HOST = 'xmmionegw.b2c.srv';
const NEW_HOST = 'api.cligw.b2c.srv';

function usage() {
  return 'Usage: claw_call.js <GET|POST> <url> [jsonBody]';
}

function transformUrl(url) {
  return url.replace(OLD_HOST, NEW_HOST);
}

function buildHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (process.env['X-ClawSid']) {
    headers['X-ClawSid'] = process.env['X-ClawSid'];
  }

  if (process.env['X-ClawToken']) {
    headers['X-ClawToken'] = process.env['X-ClawToken'];
  }

  return headers;
}

function parseBody(raw) {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`invalid JSON body: ${error.message}`);
  }
}

async function main() {
  const [, , methodRaw, rawUrl, rawBody] = process.argv;

  if (!methodRaw || !rawUrl) {
    throw new Error(usage());
  }

  const method = methodRaw.toUpperCase();

  if (method !== 'GET' && method !== 'POST') {
    throw new Error(usage());
  }

  const { clawGet, clawPost } = require('@mi/clawauth-cli-call');

  const url = transformUrl(rawUrl);
  const headers = buildHeaders();

  const data = method === 'GET'
    ? await clawGet(url, headers)
    : await clawPost(url, parseBody(rawBody), headers);

  if (typeof data === 'string') {
    process.stdout.write(data);
    if (!data.endsWith('\n')) {
      process.stdout.write('\n');
    }
    return;
  }

  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

main().catch((error) => {
  process.stderr.write((error && error.message ? error.message : String(error)) + '\n');
  process.exitCode = 1;
});
