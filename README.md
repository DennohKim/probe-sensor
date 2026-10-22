# Probe sensor: machines you can run

Interactive figures that show how an IEC 62056-21 optical probe (like the MY015-D) reads a smart water meter, and how to build one. Each figure is one standalone HTML page in the children's-book style from `prompts.md`.

| Figure | Page |
|---|---|
| 1. Reading the meter | `figures/01-reading-the-meter/index.html` |
| 2. Build your own probe | `figures/02-build-your-own/index.html` |
| 3. Inside the meter | `figures/03-inside-the-meter/index.html` |
| 4. The chip in the plug | `figures/04-ft232/index.html` |
| 5. The conversation | `figures/05-conversation/index.html` |

Open a page in a browser and press the step buttons. Space or Enter runs the next step; Manual/Auto switches modes.

## Build

Node 22+ and Google Chrome. No npm install.

```sh
node figures/01-reading-the-meter/build.mjs     # rebuild one figure (each folder has its own build.mjs + model.mjs)
```

Every number on a figure comes from its `model.mjs`; the page's "Where the numbers come from" lists the sources and flags the guesses.

## Video

```sh
node tools/record.mjs figures/01-reading-the-meter/index.html --out video/01-reading-the-meter.mp4   # 60 fps, 1500×1320, ~36 s
node tools/score.mjs video/01-reading-the-meter.mp4 video/01-reading-the-meter-scored.mp4         # lo-fi bed + sounds, -14 LUFS
node tools/jumps.mjs video/01-reading-the-meter.mp4                                                # flags frames that jump
```

## Site

```sh
node site/build.mjs                       # writes site/dist: front page, one page per figure, 1200×630 preview cards
python3 -m http.server -d site/dist 8080  # then open http://localhost:8080
SITE_URL=https://your.domain node site/build.mjs   # absolute preview-image URLs, needed before sharing links on X
```

Deploying (e.g. `vercel deploy site/dist`) is a manual step.

## Layout

- `shared/` – the step player (`stepper.js`), page frame (`page.mjs`) and theme (`book.css`) every figure uses.
- `vendor/anatomy/` – the isometric drawing kit from the [anatomy skill](https://github.com/wheresryan22/anatomy) (MIT).
- `tools/` – recorder, scorer and jump check. `site/` – the site builder.
