import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { chooseGeminiModel, config, DEFAULT_CONFIG, mcpHandler, modeNotice, TurnText } from '../plugin/plugin.js';

const manifest = JSON.parse(readFileSync(new URL('../plugin/manifest.json', import.meta.url), 'utf8'));
assert.equal(manifest.host.processes[0].program, 'agy');
assert.deepEqual(manifest.host.processes[0].args.slice(0, 3), ['acp', '--sandbox', '--process-per-session']);
assert.deepEqual(DEFAULT_CONFIG, {instructions: '', scope: 'thread', workspace: '', model: '', allowWrites: false});
assert.equal(config({workspace:'/tmp', model:'gemini-3.8-flash-low'}).model, 'gemini-3.8-flash-low');
const models = {currentModelId:'gemini-new',availableModels:[{modelId:'gemini-new'},{modelId:'gemini-other'},{modelId:'claude-other'}]};
assert.equal(chooseGeminiModel(models), 'gemini-new');
assert.equal(chooseGeminiModel(models, 'gemini-other'), 'gemini-other');
assert.throws(() => chooseGeminiModel(models, 'claude-other'));

assert.equal(modeNotice(false, false), '');
assert.match(modeNotice(false, true), /now on/);
assert.match(modeNotice(true, false), /read-only mode/);
// Only a Buzz message counts as the answer: a reaction does not hide the reply.
{
  const answeredBy = async (name) => {
    const state = {answered:false};
    const ok = async (m) => ({jsonrpc:'2.0',id:m.id,result:{content:[]}});
    await mcpHandler(ok, {}, () => state, true)({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:{}}});
    return state.answered;
  };
  assert.equal(await answeredBy('send'), true);
  assert.equal(await answeredBy('react'), false);
  assert.equal(await answeredBy('edit'), false);
}
const approval = new TurnText();
const ask = (name) => ({toolCall:{name},options:[{kind:'allow_once',optionId:'allow'}]});
assert.deepEqual(approval.permission(ask('mcp_buzz_composio_connections')), {outcome:'selected',optionId:'allow'});
assert.deepEqual(approval.permission(ask('run_command')), {outcome:'cancelled'});

const buzz = async (message) => ({jsonrpc:'2.0',id:message.id,result:{content:[{type:'text',text:'read'}]}});
let bridgeCalls = 0;
const host = {runCommand: async () => {bridgeCalls++; return JSON.stringify({ok:true,data:{login:'example'}});}};
const handler = mcpHandler(buzz, host, () => undefined);
const call = (name, args = {}) => handler({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}});
assert.equal((await call('channel_get')).result.isError, undefined);
assert.equal((await call('channel_delete')).result.isError, true);
assert.equal((await call('composio_execute', {slug:'GITHUB_DELETE_A_REPOSITORY'})).result.isError, true);
assert.equal(bridgeCalls, 0);
// Read-only mode runs no Composio action, even one named like a lookup.
assert.equal((await call('composio_execute', {slug:'GITHUB_GET_THE_AUTHENTICATED_USER',arguments:{}})).result.isError, true);
assert.equal(bridgeCalls, 0);
assert.equal((await call('composio_search', {query:'github user'})).result.isError, undefined);
assert.equal(bridgeCalls, 1);
const allowAll = mcpHandler(buzz, host, () => undefined, true);
const callAll = (name, args) => allowAll({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:args}});
assert.equal((await callAll('channel_delete', {id:'x'})).result.isError, undefined);
assert.equal((await callAll('composio_execute', {slug:'GITHUB_GET_THE_AUTHENTICATED_USER',arguments:{}})).result.isError, undefined);
assert.equal(bridgeCalls, 2);
// Outside a running turn no tool call is served, reads included.
const idle = mcpHandler(buzz, host, () => undefined, true, () => false);
assert.equal((await idle({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'read',arguments:{}}})).result.isError, true);
assert.equal(Array.isArray((await mcpHandler(async (m) => ({jsonrpc:'2.0',id:m.id,result:{tools:[]}}), host, () => undefined, false, () => false)({jsonrpc:'2.0',id:4,method:'tools/list'})).result.tools), true);

const bridge = manifest.host.commands[0];
assert.equal(bridge.program, 'python3');
assert.equal(bridge.args[0], '-c');
assert.ok(!/\/Users\/[^/]+\/REPOS/.test(JSON.stringify(manifest)));
assert.ok(!/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(JSON.stringify(manifest)));
const result = spawnSync('python3', bridge.args, {input:'{"operation":"invalid"}',encoding:'utf8'});
assert.equal(result.status, 0);
assert.equal(JSON.parse(result.stdout).ok, false);
// Values the Composio CLI could read as options are refused before it runs.
for (const request of [
  {operation:'search', query:'--help'},
  {operation:'execute', slug:'GITHUB_GET_THE_AUTHENTICATED_USER', arguments:{}, account:'-x'},
  {operation:'execute', slug:'GITHUB_GET_THE_AUTHENTICATED_USER', arguments:{}, account:'  '},
]) {
  const refused = spawnSync('python3', bridge.args, {input:JSON.stringify(request),encoding:'utf8',env:{...process.env,COMPOSIO_BIN:'/bin/false'}});
  const parsed = JSON.parse(refused.stdout);
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /dash|nonempty/);
}
console.log('Plugin checks passed');
