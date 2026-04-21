# Trakt Sync for Obsidian

Sync your Trakt activity into Obsidian.

This plugin lets you:
- Authenticate with trakt.tv using the device flow.
- Append watched items into the matching daily note for the watched date when that note already exists.
- Create movie, show, and episode pages from configurable filename and content templates.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Build the plugin:

```bash
npm run build
```

3. Copy `main.js`, `manifest.json`, and `styles.css` to:

```text
<Vault>/.obsidian/plugins/obsidian-trakt-sync/
```

4. Enable the plugin in **Settings -> Community plugins**.

## Authentication flow

1. Run command: `Trakt: authenticate`.
2. Open the shown verification URL.
3. Enter the user code shown by the plugin.
4. After authorization, access and refresh tokens are stored in plugin data.

## Sync flow

Run command: `Trakt: sync now`

During sync the plugin:
- Fetches `GET /sync/last_activities`.
- Reads recent watched history from `GET /sync/history?limit=...`.
- Appends new watched items to existing daily notes for each item's `watched_at` date.
- Creates movie, show, and episode pages from your templates.

## Daily note path detection

By default the plugin detects your daily note path automatically.

Detection order:
1. Daily settings from the `periodic-notes` plugin when daily notes are enabled there.
2. Core Obsidian `daily-notes` settings.
3. Fallback to `Daily/{{date:YYYY-MM-DD}}.md`.

You can disable auto-detection in plugin settings and provide a manual path override.

## Template tokens

### Daily note entry template
- `{{icon}}`
- `{{title}}`
- `{{note_link}}`
- `{{note_name}}`
- `{{note_path}}`
- `{{kind}}`
- `{{watched_at}}`
- `{{watched_date}}`
- `{{movie_title}}`
- `{{show_title}}`
- `{{episode_title}}`
- `{{episode_code}}`
- `{{date:YYYY-MM-DD}}` or any custom date format

Default template:

```text
- {{icon}} [[{{note_link}}]] watched
```

### Movie templates
- `{{movie_title}}`
- `{{movie_year}}`
- `{{movie_slug}}`
- `{{movie_trakt_id}}`
- `{{movie_imdb_id}}`
- `{{watched_at}}`
- `{{watched_date}}`

### Show templates
- `{{show_title}}`
- `{{show_year}}`
- `{{show_slug}}`
- `{{show_trakt_id}}`
- `{{show_imdb_id}}`
- `{{watched_at}}`
- `{{watched_date}}`

### Episode templates
- `{{show_title}}`
- `{{show_year}}`
- `{{show_slug}}`
- `{{episode_title}}`
- `{{episode_season}}`
- `{{episode_number}}`
- `{{episode_code}}`
- `{{episode_trakt_id}}`
- `{{episode_imdb_id}}`
- `{{watched_at}}`
- `{{watched_date}}`

## Notes

- Daily note sync only writes into notes that already exist; it does not create missing daily notes.
- Existing media pages are not overwritten unless `Overwrite existing pages` is enabled.
- Trakt client credentials are bundled directly into the plugin build.
- All sync behavior and templates are configured from the plugin settings tab.
- API docs: https://trakt.docs.apiary.io
