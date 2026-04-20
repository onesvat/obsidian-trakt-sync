# Trakt Sync for Obsidian

Sync your Trakt activity into Obsidian.

This plugin lets you:
- Authenticate with trakt.tv using the device flow.
- Sync `sync/last_activities` into your daily note (optional).
- Create movie/show/episode pages from configurable filename/content templates.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Provide Trakt credentials in `.env` (or set in plugin settings):

```bash
TRAKT_CLIENT_ID=your_client_id
TRAKT_CLIENT_SECRET=your_client_secret
```

3. Build plugin:

```bash
npm run build
```

4. Copy `main.js`, `manifest.json`, `styles.css` to:

```text
<Vault>/.obsidian/plugins/obsidian-trakt-sync/
```

5. Enable the plugin in **Settings -> Community plugins**.

## Authentication flow

1. Run command: `Trakt: authenticate`.
2. Open the shown verification URL.
3. Enter the user code shown by the plugin.
4. After authorization, access/refresh tokens are stored in plugin data.

## Sync flow

Run command: `Trakt: sync now`

During sync the plugin:
- Fetches `GET /sync/last_activities`.
- Optionally appends an entry to your daily note.
- Fetches `GET /sync/history?limit=...`.
- Creates movie/show/episode pages based on your templates.

## Template tokens

### Daily note entry template
- `{{synced_at}}`
- `{{synced_date}}`
- `{{movies_watched_at}}`
- `{{episodes_watched_at}}`
- `{{shows_hidden_at}}`
- `{{date:YYYY-MM-DD}}` (or custom date format)

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

- Existing pages are not overwritten unless `Overwrite existing pages` is enabled.
- `.env` is intentionally limited to credentials only (`TRAKT_CLIENT_ID`, `TRAKT_CLIENT_SECRET`).
- All sync behavior and templates are configured from the plugin Settings tab.
- API docs: https://trakt.docs.apiary.io
