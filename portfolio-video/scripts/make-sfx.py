#!/usr/bin/env python3
"""Synthesise the vertical promo's sound effects into public/audio/.

    python3 scripts/make-sfx.py

Everything is generated here from noise and sine waves, with fixed seeds, so
there are no third-party samples and no licences, and running it again gives
the same files. Each effect is written mono, 48 kHz, 16-bit, peak-normalised
to -6 dBFS; how loud each one plays is set where it is placed (src/promo/Sfx.tsx
and the scenes), and the whole mix is brought down to a quiet target loudness
when the video is encoded (scripts/encode-vertical.sh).
"""
import os
import wave

import numpy as np

SR = 48000
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "audio")
os.makedirs(OUT, exist_ok=True)


def t(sec):
    return np.arange(int(SR * sec)) / SR


def env(n, attack, release, shape=2.0):
    """Attack/release envelope over n samples (attack and release in samples)."""
    e = np.ones(n)
    a = max(1, int(attack))
    r = max(1, int(release))
    e[:a] = np.linspace(0, 1, a) ** shape
    e[n - r:] *= np.linspace(1, 0, r) ** shape
    return e


def decay(n, seconds):
    return np.exp(-np.arange(n) / (SR * seconds))


def svf(x, fc, q=0.7, mode="bp"):
    """Chamberlin state-variable filter with a per-sample cutoff (Hz)."""
    fc = np.broadcast_to(np.asarray(fc, dtype=float), x.shape)
    low = band = 0.0
    out = np.empty_like(x)
    damp = 1.0 / q
    for i in range(len(x)):
        f = 2.0 * np.sin(np.pi * min(fc[i], SR / 6) / SR)
        high = x[i] - low - damp * band
        band += f * high
        low += f * band
        out[i] = band if mode == "bp" else (low if mode == "lp" else high)
    return out


def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    s = 0.0
    for i in range(len(x)):
        s = (1 - a) * x[i] + a * s
        y[i] = s
    return y


def write(name, x, peak_db=-6.0):
    x = np.asarray(x, dtype=float)
    # A few milliseconds of fade at both ends: no clicks at the cut points.
    n = min(len(x) // 4, int(0.004 * SR))
    if n:
        x[:n] *= np.linspace(0, 1, n)
        x[-n:] *= np.linspace(1, 0, n)
    peak = np.max(np.abs(x)) or 1.0
    x = x / peak * 10 ** (peak_db / 20)
    data = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(os.path.join(OUT, f"{name}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print(f"{name}.wav  {len(x) / SR:.2f} s")


rng = np.random.default_rng(20261014)

# Whoosh: band-passed noise sweeping up, as something flies past.
def whoosh(seconds, f0, f1, seed):
    r = np.random.default_rng(seed)
    n = int(SR * seconds)
    noise = r.standard_normal(n)
    sweep = f0 * (f1 / f0) ** (np.linspace(0, 1, n) ** 1.3)
    x = svf(noise, sweep, q=1.6)
    return x * env(n, n * 0.55, n * 0.45, 1.6)

write("whoosh", whoosh(0.42, 350, 2600, 1))
write("whoosh-soft", whoosh(0.55, 250, 1500, 2))
write("whoosh-down", whoosh(0.5, 2200, 300, 3))

# Tick: a short, dry click for things landing in place.
n = int(0.07 * SR)
x = np.sin(2 * np.pi * 2300 * t(0.07)) * decay(n, 0.006) + 0.25 * rng.standard_normal(n) * decay(n, 0.002)
write("tick", svf(x, 3000, q=0.9))

# Key taps: three slightly different keystrokes on a soft keyboard.
for k in range(3):
    r = np.random.default_rng(100 + k)
    n = int(0.06 * SR)
    click = svf(r.standard_normal(n), 3800 + 700 * k, q=1.2) * decay(n, 0.004)
    thock = np.sin(2 * np.pi * (170 + 25 * k) * t(0.06)) * decay(n, 0.012)
    write(f"key-{k}", click + 0.6 * thock)

# Snap: a piece landing on the board, a low soft thump with a click on top.
n = int(0.22 * SR)
tt = t(0.22)
freq = 120 * np.exp(-tt / 0.05) + 62
thump = np.sin(2 * np.pi * np.cumsum(freq) / SR) * decay(n, 0.07)
click = svf(rng.standard_normal(n), 2400, q=1.0) * decay(n, 0.003)
write("snap", thump + 0.35 * click)

# Pop: a round blip for a button press or a number changing.
n = int(0.12 * SR)
tt = t(0.12)
freq = 880 * (1 + 0.35 * np.exp(-tt / 0.012))
write("pop", np.sin(2 * np.pi * np.cumsum(freq) / SR) * decay(n, 0.035) * env(n, 0.002 * SR, 0.02 * SR))

# Chime: two soft bell-like notes, for the stylist's answer and the end card.
def bell(f, seconds):
    n = int(SR * seconds)
    tt = t(seconds)
    x = np.sin(2 * np.pi * f * tt) + 0.28 * np.sin(2 * np.pi * f * 2.76 * tt) * decay(n, 0.25) + 0.12 * np.sin(2 * np.pi * f * 5.4 * tt) * decay(n, 0.08)
    return x * decay(n, 0.55) * env(n, 0.003 * SR, 0.05 * SR)

n = int(1.3 * SR)
x = np.zeros(n)
a = bell(659.25, 1.2)  # E5
b = bell(987.77, 1.0)  # B5
x[: len(a)] += a
off = int(0.09 * SR)
x[off: off + len(b)] += 0.8 * b
write("chime", x)

# Swell: a slow low rise into the end card.
n = int(1.4 * SR)
tt = t(1.4)
noise = onepole_lp(rng.standard_normal(n), 900)
tone = np.sin(2 * np.pi * 55 * tt) + 0.5 * np.sin(2 * np.pi * 82.4 * tt)
write("swell", (0.6 * noise + tone) * (np.linspace(0, 1, n) ** 2.2) * env(n, 1, 0.08 * SR))

# Impact: a soft, deep "whoomp" as GOO appears.
n = int(1.6 * SR)
tt = t(1.6)
freq = 70 * np.exp(-tt / 0.15) + 46
boom = np.sin(2 * np.pi * np.cumsum(freq) / SR) * decay(n, 0.45)
air = onepole_lp(rng.standard_normal(n), 600) * decay(n, 0.25)
write("impact", boom + 0.5 * air)

# Pad: a quiet, airy chord under the whole film. Detuned sines, a slow
# breathing movement, a gentle low-pass. Silent at both ends, so the loop's
# seam (black, at frame 0) is silent too.
seconds = 28.5
n = int(SR * seconds)
tt = t(seconds)
notes = [87.31, 130.81, 164.81, 196.00, 220.00, 329.63]  # F2 C3 E3 G3 A3 E4: Fmaj9
x = np.zeros(n)
for i, f in enumerate(notes):
    for det in (-0.12, 0.12):
        ph = rng.uniform(0, 2 * np.pi)
        lfo = 0.75 + 0.25 * np.sin(2 * np.pi * (0.05 + 0.013 * i) * tt + ph)
        x += np.sin(2 * np.pi * (f + det) * tt + ph) * lfo / (1 + 0.35 * i)
x = onepole_lp(x, 1400)
write("pad", x * env(n, 2.0 * SR, 2.2 * SR, 1.5))

# Rising variants, one whole tone apart: the builder's total counting up
# (pop-0…4) and the store rows cascading in (tick-0…2). Remotion's playbackRate
# changes tempo, not pitch, so each step is its own file.
for k in range(5):
    n = int(0.12 * SR)
    tt = t(0.12)
    f = 784.0 * 2 ** (2 * k / 12)  # G5 upward in whole tones
    freq = f * (1 + 0.3 * np.exp(-tt / 0.012))
    write(f"pop-{k}", np.sin(2 * np.pi * np.cumsum(freq) / SR) * decay(n, 0.04) * env(n, 0.002 * SR, 0.02 * SR))
for k in range(3):
    n = int(0.08 * SR)
    f = 1900 * 2 ** (3 * k / 12)
    r = np.random.default_rng(300 + k)
    x = np.sin(2 * np.pi * f * t(0.08)) * decay(n, 0.008) + 0.2 * r.standard_normal(n) * decay(n, 0.002)
    write(f"tick-{k}", svf(x, f * 1.2, q=0.9))
