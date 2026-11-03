import test from 'node:test';
import assert from 'node:assert/strict';

import { findGlossaryMatches } from '../src/glossary/glossaryText.js';

function termIds(text) {
  return findGlossaryMatches(text)
    .filter((segment) => segment.type === 'term')
    .map((segment) => segment.glossaryEntry.id);
}

test('glossary matching preserves the original text exactly', () => {
  const text = 'The server responds with packets, requests, and responses.';
  const renderedText = findGlossaryMatches(text)
    .map((segment) => segment.text)
    .join('');
  assert.equal(renderedText, text);
});

test('longer multiword terms take priority over overlapping terms', () => {
  assert.deepEqual(
    termIds('A DNS resolver examines network traffic from a web server.'),
    ['dns-resolver', 'network-traffic', 'server'],
  );
});

test('matching is case-insensitive and supports documented aliases', () => {
  assert.deepEqual(
    termIds('CLIENTS send DNS QUERIES to DNS SERVERS using IP addresses.'),
    ['client', 'dns-query', 'dns-server', 'ip-address'],
  );
});

test('terms do not match inside unrelated words', () => {
  assert.deepEqual(
    termIds('A connectionless protocol uses headers.'),
    ['protocol', 'header'],
  );
});

test('hyphenated document terminology is recognized', () => {
  assert.deepEqual(
    termIds('Denial-of-service attacks can cause packet loss.'),
    ['denial-of-service', 'packet-loss'],
  );
});
