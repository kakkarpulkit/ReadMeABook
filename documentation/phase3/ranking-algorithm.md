# Intelligent Ranking Algorithm

**Status:** ✅ Implemented

Evaluates and scores torrents to automatically select best audiobook download.

## Scoring Criteria (100 points max)

**1. Title/Author Match (50 pts max) - MOST IMPORTANT**
- Title matching: 0-35 pts
  - Complete title match (followed by metadata: " by", " [", " -") → 35 pts
  - Title is substring but continues with more words → fuzzy similarity (partial credit)
  - Prevents series confusion: "The Housemaid" vs "The Housemaid's Secret"
  - No exact match → fuzzy similarity (partial credit)
- Author presence: 0-15 pts
  - Exact substring match → proportional credit
  - No exact match → fuzzy similarity (partial credit)
  - Splits authors on delimiters (comma, &, "and", " - ")
  - Filters out roles ("translator", "narrator")
- Order-independent, no structure assumptions
- Ensures correct book is selected over wrong book with better format

**2. Format Quality (25 pts max)**
- M4B with chapters: 25
- M4B without chapters: 22
- M4A: 16
- MP3: 10
- Other: 3

**3. Seeder Count (15 pts max)**
- Formula: `Math.min(15, Math.log10(seeders + 1) * 6)`
- 1 seeder: 0pts, 10 seeders: 6pts, 100 seeders: 12pts, 1000+: 15pts

**4. Size Reasonableness (10 pts max)**
- Expected: 1-2 MB/min (64-128 kbps)
- Perfect match: 10 pts
- Deviation → penalty
- Unknown duration: 5 pts (neutral)

## Interface

```typescript
interface RankedTorrent extends TorrentResult {
  score: number;
  rank: number;
  breakdown: {
    formatScore: number;
    seederScore: number;
    sizeScore: number;
    matchScore: number;
    totalScore: number;
    notes: string[];
  };
}

function rankTorrents(
  torrents: TorrentResult[],
  audiobook: AudiobookRequest
): RankedTorrent[];
```

## Tech Stack

- string-similarity (fuzzy matching)
- Regex for format detection
