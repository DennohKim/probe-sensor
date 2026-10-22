# Probe sensor: visual learning prompts

Adapted from Elvar's article "How I Turn Any Question Into a Machine You Can Run"
(https://x.com/elvar_official/status/2111831136171151589), applied to the MY015-D optical probe
(https://www.aliexpress.com/item/1005010064552930.html).

**The probe:** a USB-C optical head built to IEC 62056-21 (formerly IEC 1107), with an FT232 chip inside. It is a black magnetic cup holding an IR LED and an IR sensor. It snaps onto a smart meter's optical port and reads the meter over infrared serial.

**How to use:**

1. Open Claude Code in this folder (`probe-sensor/`).
2. Paste the prompts in order, one at a time. Before you paste the next one, open the page and press the buttons.
3. Prompts 2–4 polish figure 1. Prompt 5 builds figure 2 with the same rules.

The `anatomy` skill is already installed at `~/.claude/skills/anatomy`. To install it on another machine, run `npx skills add wheresryan22/anatomy -g -a claude-code`.

---

## Core (do these in order)

### 1. Figure 1: how the probe reads a meter

```
/anatomy Someone asked me: "How does an optical probe read a smart water meter?"

Answer with a machine, not a diagram. Build a real, recognisable smart water meter on a pipe with its optical port (a steel ring around a small window, an IR LED and an IR sensor behind it), and the MY015-D optical probe: a black magnetic cup on a 2 m cable ending in a USB-C plug with an FT232 USB-to-serial chip moulded inside, plugged into a laptop. Many small parts, isometric view, one standalone HTML page.

The steps are buttons in a column on the left: [Plug in USB-C] [Snap the probe onto the port] [Send the wake-up "/?!"] [Meter says who it is] [Agree on a faster speed] [Read the meter total] [Check the checksum]. Only the next step is clickable. Each button plays that step on the machine itself.

Cut a window into the part where the real work happens: the probe head and the meter's optical port, face to face. Show the probe's LED lined up with the meter's sensor and the meter's LED lined up with the probe's sensor, the ring magnet holding them together, and every bit crossing the air gap as a flash of light. A second small window into the USB-C plug shows the FT232 turning USB packets into serial bits. The viewer sees the cause and the result together.

Write one small model of the real thing as a pure function before you draw anything. Drive every number on screen from it: [IR at about 940 nm; 300 baud, 7 data bits, even parity, 1 stop bit, so 10 bits and 33.3 ms per character; "/?!\r\n" is 5 characters, 167 ms; the meter's ID line says which speed it can switch to; after the acknowledgement both sides move to 9600 baud, 1.04 ms per character; the readout ends in a BCC checksum, the XOR of every byte after STX up to and including ETX; light on = binary 0, dark = binary 1, so the line rests dark]. Show them live on displays on the meter and the laptop, a tiny scope trace of the bits, and small chips under the figure. If you are not sure a number is real, say so and tell me where it comes from. Use a real OBIS code for the water volume register and cite it.

Under the figure, one line: "The big idea: the probe is a serial cable whose wire is a beam of invisible light."
```

### 2. Make it readable at a glance

```
Make it readable at a glance without dumbing down the numbers:
- one short hint at the top for each step, simple enough for a 7-year-old: what is happening and why
- big pill buttons with a number in a circle; the running step lights up, finished steps fade
- a small handwritten sound word on each action: click when the USB-C goes in, clack when the magnet grabs the ring, blink-blink on the light pulses, beep when the checksum matches
- a speed badge whenever a step runs faster or slower than real time, computed from the real seconds: the 167 ms wake-up and the 9600-baud readout are far too fast to see, so slow them down (×1/20, ×1/200) and keep the real times on the displays
- a switch with 2 modes above the steps: Manual by default, where nothing moves until someone presses a step and the next button pulses; Auto, where the machine runs every step by itself on a loop. Remember the choice between visits
- a "Start over" link that puts the machine back at step 1
- a toggle "See it like a phone camera" that shows the IR flashes as a purple glow, with a note that your eye can't see 940 nm but most phone cameras can
```

### 3. Give it the look

```
Style: a hand-inked children's book, not a technical drawing.
- dark navy ink outlines, 1.2 px, flat colour fills with 3 tones per colour (top lightest, sides darker)
- cream paper background (#f5f0e5), one bold colour per object: the meter in [blue], the probe in matte black, the laptop in grey; brass for the pipe fittings, steel for the port ring and the magnet
- infrared drawn as a soft red beam with a small "invisible in real life" label
- colour swatches under the figure that recolour the meter
- short, hard-edged, warm grey shadows (#ddd4c3) falling just behind each object; never blue or purple
- every dial, display and label sits on a face that nothing else hides
```

### 4. Check it like a critic

```
Before you show me anything, check it like a critic:
1. Capture a still in the middle of every step and read each one: a part hidden behind another part, text that overflows its box, a number that disagrees with the model, a probe LED that doesn't line up with the meter's sensor.
2. Scrub every move longer than 1 second at 0.1 s steps and count how many pixels change per frame. A frame that changes 3x more than its neighbours is a jump: find it and fix it.
3. Slow moves must be continuous. Never step through pre-drawn poses on a move that takes longer than a second.
4. Count the light flashes in each window against the model: the bits drawn must match the characters sent, start bit, parity and stop bit included.
Tell me what you checked and what you fixed. Show me the stills.
```

### 5. Figure 2: build your own probe

```
/anatomy Someone asked me: "How do I build my own optical probe like the MY015-D?"

Build a second figure in its own folder with the same rules as figure 1: the same look, the step buttons, the window into the mechanism, one model that drives every number, one big idea, and the critic check before you show me.

The machine is a workbench with the parts laid out and the probe coming together on it: a 3D-printed cup and cap, a ring magnet, a 940 nm IR LED, an IR phototransistor with a daylight filter, 2 resistors on a small round board, a 4-core cable, a USB-to-serial board (FT232RL; a CH340 works too) with a USB-C socket, heat-shrink, a soldering iron on its stand, a phone and a small mirror.

The steps: [Print the cup] [Push in the LED and the sensor] [Solder the resistors] [Wire 5V, GND, TX, RX] [Glue in the ring magnet] [Close the cap] [Plug in and look through the phone camera] [Mirror test]. Only the next step is clickable.

Cut a window into the side of the cup to show the LED and the sensor at the spacing the meter port needs, the circuit behind them, and current flowing when TX goes low and the LED lights. In the mirror test, light leaves the LED, bounces off the mirror into the sensor, and the letters I type come back on the laptop.

Write the model first, as a pure function: [the LED resistor from Ohm's law, (5 V − LED forward voltage) ÷ target current; the phototransistor's pull-up resistor and the RX voltage it gives in the dark and in the light, against the serial chip's logic thresholds; how much current the TX pin can sink, and whether the LED needs a transistor to drive it; the LED-to-sensor spacing and the magnet size the IEC 62056-21 port expects]. Show the values on the parts and as chips under the figure. If you are not sure a number is real, say so and tell me where it comes from. Show a parts list with the values the model picked.

Under the figure, one line: "The big idea: two parts make the probe, one LED to talk and one light sensor to listen; everything else holds them in the right place."
```

---

## Next (after figure 2 works)

### 6. Let me break it

```
Add sliders to figure 2. When one moves, run the model again and show the result in the same displays and on the laptop screen:
- how far off-centre the probe sits on the port, 0 to 6 mm: past a point the light misses the sensor and the letters come back garbled
- sunlight on the meter, from shade to direct sun: without the daylight filter the sensor saturates and every bit reads as light
- the LED resistor, 47 Ω to 2.2 kΩ: too low burns the LED or the TX pin, too high and the meter can't see the flash
- the laptop's baud rate, 300 to 19200: a mismatch with the meter turns the reply into noise
```

---

## Optional

### 7. Turn a figure into a video (3 prompts, in this order)

```
Make the tour recordable:
- add window.seek(t) that replays the whole tour from zero to time t. Any frame can then be drawn in any order
- with ?render in the URL, the page stops its own clock
- draw a cursor that walks to each button and presses it a moment before the step starts
- cut the whole tour to 36 seconds: 0.7 s between steps, the first click at 0.9 s; the main moment [the wake-up and the meter's reply crossing the air gap] stays the slowest step
```

```
Record it: open the page with ?render in headless Chrome, call window.seek() for every frame at 60 fps at 1500×1320, screenshot each frame and pipe them into ffmpeg as H.264, yuv420p, faststart. Then make a contact sheet with one frame every 3 seconds and show it to me.
```

```
Score it in code, no samples and nothing to license: a 36-second lo-fi bed at 84 BPM with soft electric piano on Fmaj7, Em7, Dm7, Cmaj7, a round bass, brushed drums after the first bar and faint vinyl crackle. On top, quiet sounds at the exact seconds of the picture: a click on every button press, the USB-C click, the magnet clack, soft ticks on the light pulses, a beep when the checksum matches. Master to -14 LUFS with the true peak under -1 dB and mux it into the video with ffmpeg.
```

### 8. More figures in parallel

```
Build these figures in parallel, one agent per figure: [inside the smart water meter, the FT232 chip, the full IEC 62056-21 conversation].
Every agent follows the rules of figure 1: the same look, the step buttons, the window into the mechanism, one model that drives every number, one big idea.
Give each one its own fact to prove, with the real number behind it: [the meter turns water flow into the number on its register; the FT232 takes a USB packet every 1 ms and clocks the bits out at the baud rate; a full readout takes several seconds at 300 baud and a fraction of a second at 9600].
Each agent works in its own folder, never edits the shared files and checks its own stills before it reports back.
```

### 9. Put them on one site

```
Put my figures on one small site:
- a front page with one card per figure: a still from its best moment, the name and one line about what it answers
- each figure on its own page with a nav on top: a menu with a thumbnail of every figure, and the ← → keys switch figures
- Space or Enter runs the next step
- links to other sites open in a new tab, so the figure stays where the viewer left it
- run it locally first; [deploy it to Vercel] only when I say so
```
