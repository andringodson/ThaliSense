# Demo video

`ThaliSense-demo.mp4` (2 min 59 s) is attached to the [v1.1 release](https://github.com/andringodson/ThaliSense/releases/tag/v1.1). It shows typed and whole-thali photo logging, plate scores, the coach agent, the 7-day plan, progress tracking and the vision benchmark. The food photos are Wikimedia Commons images under CC BY-SA; see [the fixture credits](../../tests/e2e/fixtures/README.md).

How it is made, so it can be re-recorded after UI changes:

1. `script.json`: narration, one entry per scene. Each entry is synthesised with the `en-IN-NeerjaNeural` voice (edge-tts), and its length sets that scene's length.
2. `record.mjs`: Playwright drives the live app (thalisense.vercel.app) with a visible cursor and records each scene, holding each one for as long as its narration lasts. Scene start times are written to `marks.json`.
3. ffmpeg combines the title, problem and closing slides (title, problem, benchmark and closing slides from `../submissions/deck.html#video`) with the recording, and places each narration clip at its scene's start time.
