# A quiet music bed for the demo film, made here so no licensed music is used. Writes bed.wav beside the takes.
import wave
from pathlib import Path

import numpy as np

SR = 48000
BAR = 6.0
CHORDS = [[220.0, 277.18, 329.63, 440.0], [196.0, 246.94, 293.66, 392.0], [174.61, 220.0, 261.63, 349.23], [196.0, 246.94, 329.63, 392.0]]
n = int(SR * BAR * len(CHORDS))
t = np.arange(n) / SR
out = np.zeros((n, 2))
for i, chord in enumerate(CHORDS):
    start = i * BAR
    env = np.clip((t - start) / 1.6, 0, 1) * np.clip((start + BAR + 1.6 - t) / 1.6, 0, 1)
    env = np.sin(env * np.pi / 2) ** 2
    for k, f in enumerate(chord):
        pad = np.sin(2 * np.pi * f * t + k) + 0.35 * np.sin(2 * np.pi * f * 2.001 * t) + 0.5 * np.sin(2 * np.pi * f * 0.998 * t)
        out[:, 0] += pad * env * (0.55 + 0.1 * k)
        out[:, 1] += pad * env * (0.85 - 0.1 * k)
    # A soft bell at the start of each chord.
    bell = np.sin(2 * np.pi * chord[-1] * 2 * t) * np.exp(-np.clip(t - start, 0, None) * 1.6) * (t >= start)
    out[:, 0] += bell * 0.5
    out[:, 1] += bell * 0.3
# Make the end of the loop run into its start.
fade = int(SR * 1.6)
out[:fade] += out[-fade:] * 0
out /= np.abs(out).max() * 1.1
Path("E:/jugnu-takes").mkdir(parents=True, exist_ok=True)
with wave.open("E:/jugnu-takes/bed.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((out * 32767).astype(np.int16).tobytes())
print("bed ok")
