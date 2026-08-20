# Match livestream recordings

Drop the `.mp4` files for the play-off streams in this folder, then add an
entry for each one to `videos.json` at the repo root:

```json
{
  "videos": [
    { "file": "videos/upper-bracket.mp4", "teams": ["A", "B"], "date": "2026-08-21" },
    { "file": "videos/lower-bracket.mp4", "teams": ["C", "E"], "date": "2026-08-21" }
  ]
}
```

`file` is required, and so is either `teams` or `title`:

- `teams` — the two team ids from the `teams` section of `data.json`. The tile
  captions itself with the letter and the team name, the same way the
  screenshot tiles do, and follows a team rename automatically.
- `title` — a plain string, for anything that is not a straight two-team
  match. Ignored when `teams` is given.

`date` is optional and shown under the caption. `poster` is optional — point it
at an image to use as the still frame before playback starts, otherwise the
browser picks one.

The page shows the clips in the order they appear in the file.

**Size:** GitHub warns above 50MB per file and rejects at 100MB, and a Pages
site is capped at 1GB in total. Compress the VODs before committing, or host
them elsewhere and we will switch this page to embeds instead.
