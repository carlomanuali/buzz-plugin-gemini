# Gemini for Buzz

**Put Gemini in your [Buzz](https://buzz.xyz) threads.** Mention the agent and
it answers in the conversation. It can read the thread, search Buzz and, if
you use the [Composio CLI](https://docs.composio.dev/cli/quickstart), reach
the apps you have connected there: Gmail, Calendar, GitHub, Asana, Slack and
many more.

It runs on your computer through the
[Google Antigravity CLI](https://antigravity.google/docs/getting-started?tab=cli)
(`agy acp`) and uses the Google account you signed in with there. There are
no API keys to paste and no server to host.

## Highlights

- **Your Gemini, your account.** Pick any Gemini model your Antigravity
  account offers (`agy models`), or leave the model blank and the plugin
  chooses one.
- **Knows the conversation.** Each thread (or channel) keeps its own Gemini
  session, so follow-up questions just work.
- **Buzz tools built in.** Gemini can read threads, search messages, look up
  channels and members, and read canvases and notes.
- **Connected apps through Composio (optional).** Gemini searches for the
  right Composio tool, checks its schema, then runs it with the accounts
  signed in on your computer (once you allow tool changes).
- **Read-only by default.** Changes in Buzz and Composio actions stay off
  until you allow them for that agent. Antigravity's own terminal and file
  tools are never approved.
- **Small and self-contained.** One JavaScript file and a manifest. No npm
  dependencies, no install script, no build step to install.

## Quick start

1. Install the [Antigravity CLI](https://antigravity.google/docs/getting-started?tab=cli),
   sign in (`agy acp --login`), and check that `agy models` lists Gemini
   models.
2. Make sure `python3` is installed. Optional: install the
   [Composio CLI](https://docs.composio.dev/cli/quickstart) and run
   `composio login`.
3. In Buzz desktop 1.x, open **Settings → Plugins → Manage plugins → Add**,
   add this Git repository and select the `plugin` folder. Or open the
   [Buzz install link](buzz://plugin-install?repository=https%3A%2F%2Fgithub.com%2Fcarlomanuali%2Fbuzz-plugin-gemini.git&path=plugin).
4. Create an agent of type **Gemini** and set **Workspace** to an existing
   folder on your computer, such as your home folder.
5. Mention the agent in a thread or a DM.

## Settings

| Setting | Effect |
| --- | --- |
| Allow tool changes in Buzz and Composio | Off by default: Gemini can use Buzz tools that only read, and search Composio tools and their schemas. On: it can also post, edit and react in Buzz, and run Composio actions. |
| Workspace | Absolute path of an existing folder. Antigravity's session runs there. Required. |
| Gemini model ID | Blank picks a Gemini model automatically. Otherwise an ID from `agy models`, such as `gemini-…`. Only Gemini models are accepted. |
| Instructions | Added at the start of each new Gemini session. |
| Sessions | One session per thread (default) or one per channel. |

When settings apply:

- **Allow tool changes:** from the next mention, in sessions that are
  already open too.
- **Workspace and model:** from the next mention. The conversation gets a new
  Gemini session, which is shown the conversation so far.
- **Instructions:** in new sessions (a new thread, a new workspace or model,
  or after the Antigravity process restarts).
- **Sessions:** a different scope is a different conversation, so the next
  mention starts a new session.

## How it works

- Each Gemini agent has one `agy acp` process on your computer. It runs with
  `--sandbox --process-per-session --disable-telemetry`, and holds one session
  per conversation. After 30 idle minutes the process stops. The next mention
  starts a new one, and Buzz shows it the conversation again.
- For every session, Buzz serves a local MCP server named `buzz`. It carries
  Buzz's conversation tools plus four Composio tools: `composio_connections`,
  `composio_search`, `composio_schema` and `composio_execute`. These call the
  Composio CLI through a small Python bridge embedded in the manifest. The
  bridge runs only fixed `composio` subcommands, never a shell command or a
  program chosen by the model.
- The first message of a new session starts with a short header from the
  plugin: the agent's name, where it is answering, that its final message is
  the reply, and your instructions. Nothing from the agent's Buzz memory,
  teams or repositories is sent.
- Gemini's final message is posted as the agent's reply. If Gemini already
  replied with a Buzz tool, nothing is posted twice.

## Behaviour

- **Who can start a turn:** only your own mentions. Buzz's harness checks
  this. Watches, timers and other plugins' wakes are ignored, because the
  agent works with your accounts.
- **Approvals:** the plugin approves Gemini's calls to the `buzz` MCP server
  one at a time and declines everything else, including Antigravity's
  terminal and file-edit tools. Nothing is approved after you press Stop.
- **Read-only mode** (the default) allows a fixed list of Buzz tools that
  only read, plus `composio_connections`, `composio_search` and
  `composio_schema`. No Composio action runs (`composio_execute`), not even
  one named like a lookup: the plugin cannot know which upstream actions
  have side effects. Every other call is refused with a message that tells
  Gemini to ask you to allow changes.
- **Only during a turn:** the tool server answers calls only while a turn
  is running and current. After the answer, after Stop, and between
  mentions, every call is refused.
- Turns in one conversation run one at a time. Stop cancels the running
  turn. Starting `agy acp` and opening a session each have 60 seconds, and a
  turn has 20 minutes. A missed deadline replaces the process.
- **Failures** are posted in the conversation and tag you. A post uses only
  the plugin's own words and a reference; the details go to the Buzz app log
  under that reference.

## Privacy and trust

- The prompt sent to Gemini includes the conversation the agent is shown and
  your instructions. Tool results, from Buzz or from connected apps, also go
  to the model. Use a Google account and model whose data terms suit that
  content.
- With **Allow tool changes** on, Gemini can act on your Buzz account and on
  every app connected in your Composio CLI whenever you mention it. That
  includes being steered by text it reads, such as earlier messages in the
  thread or content from a connected app. Turn it on only for an agent you
  trust, with instructions you wrote.
- The plugin stores no credentials. Antigravity and Composio keep their own
  sign-ins on your computer. The plugin never adds
  `--dangerously-skip-permissions`.
- The Composio bridge refuses search queries and account names that start
  with a dash, so the model cannot pass options to the Composio CLI.

## Requirements

- Buzz desktop 1.x. Checked with Buzz 1.0.6 on macOS.
- The Antigravity CLI (`agy`) on the `PATH` Buzz sees. Checked with
  `agy` 1.5.14.
- Python 3 (`python3`) for the Composio bridge.
- Optional: the Composio CLI, signed in. On macOS the bridge also looks in
  `~/.local/bin/composio` when Buzz's `PATH` does not include it.

Other platforms and versions should work but have not been checked.

## Development

```sh
npm run build   # embed src/composio_bridge.py into plugin/manifest.json
npm run check   # syntax checks, unit tests, runtime tests against a stand-in agy
```

`plugin/` is the installable folder: `manifest.json` and one self-contained
`plugin.js`, with no imports. Edit the bridge in `src/composio_bridge.py` and
run `npm run build`; CI fails if the manifest is out of date.

## License

Apache-2.0. See [LICENSE](LICENSE).
