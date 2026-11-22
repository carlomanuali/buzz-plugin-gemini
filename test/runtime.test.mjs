// GeminiRuntime against a stand-in `agy acp` and harness: sessions are reused,
// a new model or workspace opens a new session, and the Allow tool changes
// setting reaches an open session from the next mention.
import assert from 'node:assert/strict';
import { GeminiRuntime } from '../plugin/plugin.js';

const calls = [];
let nextSession = 0;

function fakeHost() {
  const servers = [];
  const host = {
    servers,
    duringPrompt: undefined,
    inTurn: undefined,
    async spawn(_id, { onStdout }) {
      const out = (message) => queueMicrotask(() => onStdout(`${JSON.stringify(message)}\n`));
      return {
        exited: new Promise(() => {}),
        async kill() {},
        async write(line) {
          const message = JSON.parse(line);
          if (message.id === undefined || message.method === undefined) return;
          calls.push({ method: message.method, params: message.params });
          const reply = (result) => out({ jsonrpc: '2.0', id: message.id, result });
          switch (message.method) {
            case 'initialize': return reply({ protocolVersion: 1 });
            case 'session/new': return reply({
              sessionId: `s${++nextSession}`,
              models: {
                currentModelId: 'gemini-a',
                availableModels: [{ modelId: 'gemini-a' }, { modelId: 'gemini-b' }, { modelId: 'other-c' }],
              },
            });
            case 'session/prompt':
              // Tool calls Gemini makes while the turn runs.
              if (host.duringPrompt) host.inTurn = await host.duringPrompt();
              out({
                jsonrpc: '2.0', method: 'session/update',
                params: {
                  sessionId: message.params.sessionId,
                  update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'hello' } },
                },
              });
              return reply({ stopReason: 'end_turn' });
            default: return reply({});
          }
        },
      };
    },
    async serveMcp(handler) {
      const server = { handler, url: 'http://127.0.0.1:1/mcp', headers: {}, closed: new Promise(() => {}), async close() {} };
      servers.push(server);
      return server;
    },
  };
  return host;
}

const replies = [];
const harness = {
  async conversation() { return { key: 'thread-1', where: 'a thread' }; },
  tools() {
    return async (message) => ({ jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: 'ok' }] } });
  },
  async turnPrompt() { return { text: 'question', cursor: 1, restore() {} }; },
  async reply(_agent, _conversation, text) { replies.push(text); },
};

let saved = { workspace: '/tmp', model: '', allowWrites: false };
const host = fakeHost();
const runtime = new GeminiRuntime(host, harness, { current: () => saved });

let stop;
async function mention() {
  let done;
  await runtime.run({
    trigger: { type: 'mention' },
    agent: { key: 'agent-1', name: 'Test Gemini' },
    config: { workspace: '/tmp' },
    workingUntil: (promise) => { done = promise; },
    interruptible: (fn) => { stop = fn; },
  });
  return done;
}
const count = (method) => calls.filter((call) => call.method === method).length;
const toolCall = (server) => server.handler({
  jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'channel_delete', arguments: { id: 'x' } },
});

// Each turn deletes a channel through its tool server while it runs.
host.duringPrompt = async () => (await toolCall(host.servers.at(-1))).result.isError;

// First mention: one process, one session on the automatic Gemini model.
assert.deepEqual(await mention(), { ok: true });
assert.deepEqual(replies, ['hello']);
assert.equal(count('initialize'), 1);
assert.equal(count('session/new'), 1);
assert.equal(calls.find((call) => call.method === 'session/set_model').params.modelId, 'gemini-a');
assert.equal(host.inTurn, true);

// Writes turned on: same session, and its tool server now allows changes.
saved = { ...saved, allowWrites: true };
await mention();
assert.equal(count('session/new'), 1);
assert.equal(host.inTurn, undefined);
const promptText = () => calls.filter((call) => call.method === 'session/prompt').at(-1).params.prompt[0].text;
assert.match(promptText(), /^<buzz-context>Allow tool changes is now on/);

// Once the turn is over, the open server refuses every call, writes included.
const after = await toolCall(host.servers[0]);
assert.equal(after.result.isError, true);
assert.match(after.result.content[0].text, /No Gemini turn is running/);

// Writes turned off again: refused in the same open session.
saved = { ...saved, allowWrites: false };
await mention();
assert.equal(count('session/new'), 1);
assert.equal(host.inTurn, true);
assert.match(promptText(), /^<buzz-context>You are in read-only mode/);
// The same mode again: no notice.
await mention();
assert.equal(promptText(), 'question');

// A new model: the old session is closed and a new one opens on that model.
saved = { ...saved, model: 'gemini-b' };
await mention();
assert.equal(count('session/new'), 2);
assert.equal(count('session/close'), 1);
assert.equal(calls.filter((call) => call.method === 'session/set_model').at(-1).params.modelId, 'gemini-b');

// A new workspace: another new session, opened in that directory.
saved = { ...saved, workspace: '/var' };
await mention();
assert.equal(count('session/new'), 3);
assert.equal(calls.filter((call) => call.method === 'session/new').at(-1).params.cwd, '/var');

// A model that is not Gemini is refused with a post that tags the owner.
saved = { ...saved, model: 'other-c' };
const failed = await mention();
assert.equal(failed.ok, false);
assert.match(replies.at(-1), /Gemini model other-c is unavailable/);
// The failed change kept the working session: back on the old model, the
// same session answers and none opens.
const workingSession = calls.filter((call) => call.method === 'session/prompt').at(-1).params.sessionId;
const opened = count('session/new');
saved = { ...saved, model: 'gemini-b' };
assert.deepEqual(await mention(), { ok: true });
assert.equal(count('session/new'), opened);
assert.equal(calls.filter((call) => call.method === 'session/prompt').at(-1).params.sessionId, workingSession);

// A relative workspace is refused before anything starts.
saved = { ...saved, model: '', workspace: 'relative/path' };
const sessionsBefore = count('session/new');
assert.equal((await mention()).ok, false);
assert.match(replies.at(-1), /absolute Workspace path/);
assert.equal(count('session/new'), sessionsBefore);

// Stop: a tool call that arrives after the owner pressed Stop is refused,
// even with writes allowed.
saved = { workspace: '/tmp', model: '', allowWrites: true };
host.duringPrompt = async () => {
  await stop();
  return (await toolCall(host.servers.at(-1))).result.content[0].text;
};
await mention();
assert.match(host.inTurn, /No Gemini turn is running/);

runtime.dispose();
console.log('Runtime checks passed');
