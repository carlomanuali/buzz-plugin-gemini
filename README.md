# Gemini for Buzz

Bring a Gemini model from the [Google Antigravity CLI](https://antigravity.google/docs/getting-started?tab=cli) into [Buzz](https://buzz.xyz). The agent can answer in threads, use Buzz's conversation tools, and optionally use the connected accounts in the Composio CLI.

This plugin uses the local `agy acp` server. It works with **Gemini model IDs advertised by your own Antigravity account**, without a fixed model or account. Leave the model field blank for automatic Gemini selection, or enter an ID from `agy models`. Availability and authentication depend on your Antigravity account.

## Install

1. Install the [Antigravity CLI](https://antigravity.google/docs/getting-started?tab=cli), sign in with `agy` or `agy acp --login`, and check `agy models`.
2. Install Python 3. The `python3` command must be available to Buzz. For Composio tools, also install and sign in to the [Composio CLI](https://docs.composio.dev/cli/quickstart) (`composio login`). Composio is optional; Buzz tools work without it.
3. In Buzz desktop 1.x, open **Settings → Plugins → Manage plugins → Add**, then add this Git repository and select the `plugin` folder. Or use the [Buzz install link](buzz://plugin-install?repository=https%3A%2F%2Fgithub.com%2Fcarlomanuali%2Fbuzz-plugin-gemini.git&path=plugin).
4. Create an agent of type **Gemini**, set **Workspace** to an existing absolute directory on your computer, and optionally set a Gemini model ID. Mention the agent in a DM or thread.

The `plugin/` folder is ready to install. Its `manifest.json` embeds the small Python bridge so no path to the plugin source is needed at runtime. The plugin has no npm dependencies or install script.

## Tools and access

- Buzz tools are provided by Buzz in a local MCP server for each conversation.
- With Composio installed, `composio_connections`, `composio_search`, `composio_schema`, and `composio_execute` use the CLI account signed in on **your** computer.
- The plugin accepts Antigravity's one-call permission request for tools on that MCP server. By default, Buzz tools that change state and Composio actions that do not look like read operations are refused. The name-based Composio read check is conservative, but not a formal guarantee that an upstream tool has no side effects.
- **Allow tool changes in Buzz and Composio** is an opt-in agent setting. It permits the MCP tools to act on the connected accounts, including sending messages or changing data. Enable it only if you trust the agent and its instructions. The agent is told to make changes only when its owner asks.
- Antigravity's own terminal and file-edit permissions are declined. It runs with `--sandbox`; the plugin never adds `--dangerously-skip-permissions`.
- The prompt sent to Antigravity includes the current Buzz conversation and your agent instructions. Tool calls may send data from Buzz or connected services to the selected model. Buzz core memory, teams and repositories are not appended by this plugin.

The plugin has been tested on macOS with Buzz 1.0.6 and `agy` 1.5.14. Other combinations need their own verification. Python 3 and the CLI executables must be discoverable by Buzz; on macOS, the Composio bridge also checks `~/.local/bin/composio` when Buzz's `PATH` omits it.

## Development

```sh
npm run build
npm run check
```

`scripts/build.mjs` packages `src/composio_bridge.py` into `plugin/manifest.json`. The private `dist/` folder is excluded from Git. There are no runtime npm dependencies.

## License

Apache-2.0. See [LICENSE](LICENSE).
