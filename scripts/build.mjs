import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const bridge = readFileSync(join(root, 'src/composio_bridge.py'), 'utf8');
const manifest = {
  id: 'carlomanuali.antigravity',
  name: 'Gemini (Antigravity)',
  apiVersion: 1,
  description: 'Run an available Gemini model in Buzz through the local Antigravity CLI, with Buzz and optional Composio tools.',
  discovery: { category: 'agents', tags: ['Gemini', 'Antigravity', 'ACP'] },
  host: {
    mcp: true,
    files: true,
    commands: [{
      id: 'composio-bridge',
      program: 'python3',
      args: ['-c', bridge],
      maxInputBytes: 65536,
      maxOutputBytes: 1048576,
    }],
    processes: [{
      id: 'antigravity',
      program: 'agy',
      args: ['acp', '--sandbox', '--process-per-session', '--disable-telemetry'],
    }],
  },
};
writeFileSync(join(root, 'plugin/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
