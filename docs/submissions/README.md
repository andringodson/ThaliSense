# Hackathon submissions

ThaliSense is entered in four Unstop hackathons. Each one fits a named theme.

| Hackathon | Theme it fits | What to submit | Due | File |
|---|---|---|---|---|
| **2nd LaserHack 2026** (Lasell University) | HealthTech, AI | Round 1: 2-page idea PDF | **12 Oct** | [ThaliSense-LaserHack-Idea.pdf](ThaliSense-LaserHack-Idea.pdf) |
| | | Round 2 (if shortlisted): working prototype + live virtual pitch | 17–18 Oct | live app + Nexus deck |
| **Hack-A-Throne National 2026** (team Gems) | HealthTech & Wellbeing | Round 1: online form (domain, problem, solution, description, stack) | **15 Oct** | [hack-a-throne-round1.md](hack-a-throne-round1.md) |
| | | Round 2: GitHub link, live link, demo video (Google Drive) | 21–23 Oct | repo + live app + demo video |
| **SHAKTI Hackathon** (BUBBLESORT) | Obesity Control & Medical Fitness; AI-Agentic | Round 1: PPT/PDF (Problem → Solution → Technology → Implementation → Impact) | **21 Oct, 12:00 IST** | [ThaliSense-Shakti-Deck.pdf](ThaliSense-Shakti-Deck.pdf) |
| | | Round 2: video presentation showing the working project | 23–25 Oct | demo video |
| **NEXUS InnovateX 2026** | Any domain, AI | Round 2: 15-min MCQ quiz (1 Nov); Round 3: idea PPT + 2–3 min video pitch | 2–3 Nov | [ThaliSense-Nexus-IdeaPitch.pdf](ThaliSense-Nexus-IdeaPitch.pdf) |

Links for every form:

- Live app: https://thalisense.vercel.app
- Code: https://github.com/andringodson/ThaliSense
- Demo video (2 min 59 s): https://github.com/andringodson/ThaliSense/releases/download/v1.1/ThaliSense-demo.mp4

Hack-A-Throne asks for a Google Drive link for the video. Upload `ThaliSense-demo.mp4` to Drive, set sharing to *Anyone with the link*, and paste that link.

## Rebuilding the PDFs

The PDFs are printed from the HTML sources here with headless Chromium (Playwright):

- `laserhack-idea.html` → A4, 2 pages
- `deck.html#shakti` and `deck.html#nexus` → 1280×720 slides, one source for both decks

Screenshots come from `docs/screenshots/`.
