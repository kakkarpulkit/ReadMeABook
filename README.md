# ReadMeABook

**[HERO SCREENSHOT PLACEHOLDER: Full-width hero image showing the main dashboard with recent requests, BookDate swipe interface preview, and library stats - something that looks modern and shows off the UI]**

An audiobook automation system that connects your Plex library to torrent and Usenet indexers. Request audiobooks through a web interface and they're automatically downloaded, organized, and imported into your Plex library.

## What It Does

If you're running Plex with an audiobook library, you know the drill: search for torrents or NZBs manually, download them, move files to the right folder, wait for Plex to scan. ReadMeABook automates all of that.

It works like the *arr apps (Sonarr, Radarr) but for audiobooks. Connect it to Prowlarr for searching, qBittorrent or SABnzbd for downloading, and Plex for your library. Request a book and everything else happens automatically.

There's also BookDate - an AI-powered recommendation system that suggests audiobooks based on what you already own. Think Tinder but for books. Swipe right to request, left to skip.

## Features

- **Plex Integration** - OAuth login, automatic library scanning, fuzzy matching
- **Torrent Support** - qBittorrent and Transmission clients
- **Usenet Support** - SABnzbd for NZB downloads
- **Prowlarr Integration** - Search both torrents and Usenet indexers
- **Request Management** - Track downloads from search to completion
- **BookDate Recommendations** - AI-powered suggestions with swipe interface (OpenAI/Claude)
- **Chapter Merging** - Automatically combine multi-file downloads into single M4B with chapter markers
- **E-book Sidecar** - Optional e-book downloads from Anna's Archive
- **Multi-User Support** - Role-based access (admin/user), request approval system
- **Setup Wizard** - 9-step guided configuration with connection testing

## Screenshots

**[SCREENSHOT PLACEHOLDER: Dashboard page showing active requests with status badges (Searching/Downloading/Completed) and recent activity]**

**[SCREENSHOT PLACEHOLDER: BookDate interface with the card stack showing a book cover, AI reasoning, and the swipe gesture indicators]**

**[SCREENSHOT PLACEHOLDER: Settings page showing the Prowlarr/qBittorrent/SABnzbd configuration form with connection test buttons]**

## Quick Start

Prerequisites: Docker, Plex Media Server, and either qBittorrent or SABnzbd. Prowlarr is highly recommended for searching indexers.

### Docker Compose

```yaml
services:
  readmeabook:
    image: ghcr.io/kikootwo/readmeabook:latest
    container_name: readmeabook
    restart: unless-stopped
    ports:
      - "3030:3030"
    volumes:
      - ./config:/app/config
      - ./cache:/app/cache
      - ./downloads:/downloads
      - ./media:/media
      - ./pgdata:/var/lib/postgresql/data
      - ./redis:/var/lib/redis
    environment:
      # Optional - set to your user/group ID for proper file permissions
      PUID: 1000
      PGID: 1000

      # Required if accessing from outside localhost (for Plex OAuth)
      PUBLIC_URL: "https://audiobooks.example.com"
```

Update the volume paths to match your setup:
- `/downloads` should point to your download client's directory
- `/media` should point to your Plex audiobook library

Start it:
```bash
docker compose up -d
```

Navigate to http://localhost:3030 and run through the setup wizard.

### Initial Configuration

The setup wizard walks you through:
1. Admin account creation
2. Plex server connection and library selection
3. Prowlarr configuration (API key and indexer selection)
4. Download client setup (qBittorrent or SABnzbd)
5. Path configuration with validation
6. Optional BookDate AI recommendations
7. Review and finalization

After setup, the first library scan runs automatically. You can start requesting audiobooks immediately.

## How It Works

**Request Flow:**
1. Search for an audiobook (pulls metadata from Audible)
2. Submit a request
3. Prowlarr searches your configured indexers (torrents and/or NZBs)
4. Best result is selected based on seeders, file size, and quality
5. Download starts in qBittorrent or SABnzbd
6. Files are monitored until completion
7. Multi-file audiobooks are optionally merged into M4B with chapter markers
8. Files are organized into your Plex library using configurable folder templates
9. Plex scans and matches the audiobook
10. Request marked as complete

**BookDate Flow:**
1. Configure AI provider in settings (OpenAI or Claude)
2. Set your library scope (full library, rated books only, or pick favorites)
3. AI analyzes your library and suggests recommendations
4. Swipe right to request, left to skip, up to dismiss
5. Requests are processed like normal requests

The system runs background jobs for library scanning, Audible metadata refresh, and request status checks. Everything is logged and visible in the admin dashboard.

## Architecture

Built with Next.js, PostgreSQL, and Redis. The container includes all three services in a single unified image. Background jobs are handled by Bull queues with Redis.

Authentication uses Plex OAuth, so users log in with their existing Plex accounts. The first user automatically becomes an admin. Admins can enable a request approval system if needed.

## Configuration

All configuration happens in the web UI. The only environment variables you might need are:
- `PUBLIC_URL` - Required for OAuth redirects if not using localhost
- `PUID`/`PGID` - Optional, for file permission mapping
- `LOG_LEVEL` - Optional, defaults to `info`

Secrets (JWT keys, database password, encryption keys) are auto-generated on first run and persisted to `/app/config/.secrets`.

## Advanced Features

**Chapter Merging:** When enabled, multi-file audiobook downloads (separate MP3/M4A files per chapter) are automatically merged into a single M4B file with proper chapter markers. Works for both M4A (fast, codec copy) and MP3 (re-encoded to AAC).

**E-book Sidecar:** Optionally downloads e-books from Anna's Archive to accompany audiobooks. Files are placed in the same folder as the audiobook. Supports EPUB, PDF, MOBI, and AZW3 formats.

**Request Approval:** Admins can enable a request approval system where user requests must be approved before processing. Useful for managing indexer limits or controlling library growth.

**Remote Path Mapping:** If your download client runs on a different machine or container, path mapping ensures ReadMeABook can find completed downloads.

## Contributing

Found a bug? Want to add a feature? Pull requests are welcome. The codebase is documented in the `documentation/` directory.

If you want to discuss ideas or get help, join the Discord: **[DISCORD LINK PLACEHOLDER]**

## Support

If this project is useful to you, the best way to support it is:
- Star the repo
- Share it with others who might find it useful
- Contribute code, documentation, or bug reports

Financial contributions are not expected or necessary. This project exists because I wanted it for myself, and sharing it costs nothing extra.

## License

MIT - See LICENSE file

---

Built for people who want their audiobook library to just work.
