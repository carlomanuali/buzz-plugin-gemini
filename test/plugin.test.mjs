import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { chooseGeminiModel, config, DEFAULT_CONFIG, mcpHandler, TurnText } from '../plugin/plugin.js';

const manifest = JSON.parse(readFileSync(new URL('../plugin/manifest.json', import.meta.url), 'utf8'));
assert.equal(manifest.host.processes[0].program, 'agy');
assert.deepEqual(manifest.host.processes[0].args.slice(0, 3), ['acp', '--sandbox', '--process-per-session']);
assert.deepEqual(DEFAULT_CONFIG, {instructions: '', scope: 'thread', workspace: '', model: '', allowWrites: false});
assert.equal(config({workspace:'/tmp', model:'gemini-3.8-flash-low'}).model, 'gemini-3.8-flash-low');
const models = {currentModelId:'gemini-new',availableModels:[{modelId:'gemini-new'},{modelId:'gemini-other'},{modelId:'claude-other'}]};
assert.equal(chooseGeminiModel(models), 'gemini-new');
assert.equal(chooseGeminiModel(models, 'gemini-other'), 'gemini-other');
assert.throws(() => chooseGeminiModel(models, 'claude-other'));

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
assert.equal((await call('composio_execute', {slug:'GITHUB_GET_THE_AUTHENTICATED_USER',arguments:{}})).result.isError, undefined);
assert.equal(bridgeCalls, 1);
const allowAll = mcpHandler(buzz, host, () => undefined, true);
assert.equal((await allowAll({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'channel_delete',arguments:{id:'x'}}})).result.isError, undefined);

const bridge = manifest.host.commands[0];
assert.equal(bridge.program, 'python3');
assert.equal(bridge.args[0], '-c');
assert.ok(!/\/Users\/[^/]+\/REPOS/.test(JSON.stringify(manifest)));
assert.ok(!/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(JSON.stringify(manifest)));
const result = spawnSync('python3', bridge.args, {input:'{"operation":"invalid"}',encoding:'utf8'});
assert.equal(result.status, 0);
assert.equal(JSON.parse(result.stdout).ok, false);
console.log('Plugin checks passed');
