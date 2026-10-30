# The sound of the Jugnu films, synthesised from nothing (no licensed music) and mixed on the cue sheet.
# Usage: python video/score.py intro
import json, subprocess, sys
from pathlib import Path
import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
HERE = Path(__file__).parent
ASSETS = HERE / "assets"
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)
rng = np.random.default_rng(5)


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def bus(dur):
    return np.zeros((int(dur * SR), 2), dtype=np.float64)


def put(b, x, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= len(b):
        return
    x = x[: len(b) - i]
    if x.ndim == 1:
        b[i : i + len(x), 0] += x * gain * np.cos((pan + 1) * np.pi / 4)
        b[i : i + len(x), 1] += x * gain * np.sin((pan + 1) * np.pi / 4)
    else:
        b[i : i + len(x)] += x * gain


def tv(d):
    return np.arange(int(d * SR)) / SR


def bandpass(x, lo, hi):
    return sosfilt(butter(4, [lo, hi], btype="band", fs=SR, output="sos"), x)


def lowpass(x, hi):
    return sosfilt(butter(2, hi, btype="low", fs=SR, output="sos"), x)


def highpass(x, lo):
    return sosfilt(butter(2, lo, btype="high", fs=SR, output="sos"), x)


def thump(power=1.0):
    t = tv(1.3)
    f = 34 + 90 * np.exp(-t * 22)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.6)
    click = lowpass(rng.standard_normal(len(t)), 3500) * np.exp(-t * 90) * 0.35
    return np.tanh((body + click) * 1.6) * power


def tick():
    t = tv(0.03)
    return np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 260)


def bell(f, d=2.6):
    t = tv(d)
    x = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * k) for r, a, k in [(1, 1, 2.2), (2.76, 0.45, 3.8), (5.4, 0.22, 6), (8.93, 0.1, 9)])
    return x * np.minimum(1, t / 0.002)


def pluck(f, d=0.9):
    t = tv(d)
    x = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(4 * np.pi * f * t) * np.exp(-t * 6)
    return x * np.exp(-t * 4.5) * np.minimum(1, t / 0.003)


def pad(freqs, d, cutoff=900, attack=1.2, release=1.6):
    t = tv(d)
    x = np.zeros(len(t))
    for f in freqs:
        for det in (-0.35, 0.0, 0.42):
            ph = rng.uniform(0, 6.28)
            x += np.sign(np.sin(2 * np.pi * (f + det) * t + ph)) * 0.25 + np.sin(2 * np.pi * (f + det) * t + ph)
    x = lowpass(x, cutoff) / (len(freqs) * 3)
    return x * np.minimum(1, t / attack) * np.minimum(1, (d - t) / release)


def riser(d):
    t = tv(d)
    n = rng.standard_normal(len(t))
    out = np.zeros(len(t))
    # a noise band sweeping upward
    steps = 40
    for s in range(steps):
        a, b = int(s * len(t) / steps), int((s + 1) * len(t) / steps)
        fc = 300 * (40 ** (s / steps))
        out[a:b] = bandpass(n[a:b], fc * 0.7, min(fc * 1.3, 20000))
    return out * (t / d) ** 2.4


def ringback(d):
    # India: 400 Hz with 25 Hz modulation, 0.4 on / 0.2 off / 0.4 on
    t = tv(d)
    x = np.sin(2 * np.pi * 400 * t) * (0.6 + 0.4 * np.sin(2 * np.pi * 25 * t))
    gate = (((t >= 0) & (t < 0.4)) | ((t >= 0.6) & (t < 1.0))).astype(float)
    gate = np.convolve(gate, np.ones(240) / 240, mode="same")
    return x * gate


def reverb(x, secs=2.6, wet=0.25):
    t = tv(secs)
    ir = np.stack([rng.standard_normal(len(t)), rng.standard_normal(len(t))], axis=1) * (np.exp(-t * 2.4))[:, None]
    ir = np.apply_along_axis(lambda c: lowpass(c, 6000), 0, ir)
    out = np.stack([fftconvolve(x[:, i], ir[:, i])[: len(x)] for i in range(2)], axis=1)
    out /= max(1e-9, np.abs(out).max())
    return x + out * np.abs(x).max() * wet * 3


def envelope(x, fps=30):
    hop = SR // fps
    v = np.array([np.sqrt(np.mean(x[i : i + hop] ** 2)) for i in range(0, len(x), hop)])
    v = v / max(1e-9, v.max())
    return [round(float(a) ** 0.7, 3) for a in v]


D_MINOR = [73.42, 110.0, 146.83, 174.61, 220.0]  # D2 A2 D3 F3 A3
D_MAJOR = [73.42, 110.0, 146.83, 185.0, 220.0, 293.66, 369.99]
PENTA = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25, 739.99, 880.0, 987.77, 1174.66]


def intro():
    Q = json.loads((ASSETS / "intro-cues.json").read_text())
    dur = Q["duration"]
    music, fx, voice = bus(dur + 3), bus(dur + 3), bus(dur + 3)

    jugnu, teacher = load(ASSETS / "jugnu.mp3"), load(ASSETS / "teacher.mp3")
    (ASSETS / "env.json").write_text(json.dumps({"jugnu": envelope(jugnu), "teacher": envelope(teacher)}))

    # --- tension: a low minor pad under the facts
    put(music, pad(D_MINOR[:3], Q["call"] + 0.4, cutoff=520, attack=1.6, release=0.3), 0, 0.4)
    put(music, pad([587.33, 880.0], Q["nobody"] - Q["cracked"] + 1.2, cutoff=2200, attack=0.9, release=0.8), Q["cracked"], 0.1)
    # a heartbeat that speeds up to the ring
    for bt in np.concatenate([np.arange(0.7, 4.0, 0.82), np.arange(4.0, 5.7, 0.62)]):
        put(fx, thump(0.2), float(bt))

    # --- headline hits
    put(fx, thump(0.75), Q["schools"])
    put(fx, thump(0.6), Q["officers"])
    for i in range(16):
        put(fx, tick(), Q["schools"] + 0.9 * (1 - (1 - i / 16) ** 2), 0.16, pan=rng.uniform(-0.3, 0.3))
    for j in range(7):
        put(fx, bell(440 * 2 ** (j / 12) * 0.5, 1.2), Q["officers"] + 0.06 * j, 0.05, pan=-0.6 + j * 0.2)

    # --- the flare, then the silence around "nobody knows"
    put(fx, bell(880), Q["cracked"] + 0.1, 0.34, pan=0.25)
    put(fx, bell(1318.5), Q["cracked"] + 0.22, 0.2, pan=0.35)
    put(fx, bell(1760), Q["cracked"] + 0.34, 0.13, pan=0.45)
    put(fx, thump(0.55), Q["nobody"])

    # --- the phone
    rb = bandpass(ringback(1.05), 300, 3400)
    put(fx, rb, Q["ring"], 0.2, pan=0.15)
    t = tv(0.03)
    put(fx, lowpass(rng.standard_normal(len(t)), 5000) * np.exp(-t * 180), Q["call"] - 0.02, 0.45)

    # --- the call: warm major, very quiet under the voices
    call_len = Q["spread"] - Q["call"] + 0.6
    put(music, pad([146.83, 220.0, 293.66, 369.99], call_len, cutoff=850, attack=1.8, release=1.0), Q["call"], 0.27)
    j = bandpass(jugnu, 280, 3500)
    j = np.tanh(j * 2.2) / 2.2  # the phone line
    put(voice, j, Q["jugnu"], 2.7, pan=-0.05)
    put(voice, highpass(teacher, 90), Q["teacher"], 2.5, pan=0.05)
    # the card landing: "Jugnu heard"
    put(fx, bell(1174.66, 1.6), Q["teacher"] + 1.5, 0.14, pan=0.5)
    put(fx, bell(1567.98, 1.4), Q["teacher"] + 1.62, 0.1, pan=0.55)

    # --- the spread: plucks climbing as the light travels, thickening towards the logo
    s0, s1 = Q["spread"], Q["logo"]
    put(music, pad([146.83, 220.0, 293.66, 369.99, 440.0], s1 - s0 + 1.4, cutoff=1500, attack=1.0, release=0.8), s0, 0.55)
    put(fx, thump(0.75), s0)
    step = 0.1875
    n = int((s1 - s0) / step)
    for i in range(n):
        k = i / n
        note = PENTA[min(len(PENTA) - 1, int(k * 8) + [0, 2, 1, 3][i % 4])]
        put(music, pluck(note), s0 + i * step, 0.14 + 0.1 * k, pan=np.sin(i * 1.3) * 0.6)
    # sparkle: tiny high blips, thickening as more schools light up
    for _ in range(170):
        u = rng.random() ** 0.7
        f = rng.choice([1760.0, 1975.5, 2349.3, 2637.0, 2960.0, 3520.0])
        put(fx, bell(f, 0.35), s0 + 0.2 + u * (s1 - s0), 0.02, pan=rng.uniform(-0.85, 0.85))
    put(fx, riser(Q["flash"] - s1 + 1.2), s1 - 1.2, 0.28)

    # --- the logo: the whole chord opens
    f = Q["flash"]
    put(fx, thump(0.95), f)
    put(music, pad(D_MAJOR, dur - f + 2.2, cutoff=2400, attack=0.08, release=2.6), f, 0.95)
    for i, n_ in enumerate([587.33, 739.99, 880.0, 1174.66, 1479.98]):
        put(fx, bell(n_, 3.4), f + 0.06 * i, 0.22 - 0.03 * i, pan=-0.4 + 0.2 * i)
    # a last firefly
    put(fx, bell(2349.32, 2.2), f + 2.1, 0.07, pan=0.35)

    # --- mix: duck the music under speech, a room around everything
    mix_env = np.ones(len(music))
    a, b = int(Q["jugnu"] * SR), int((Q["teacher"] + 3.0) * SR)
    mix_env[a:b] = 0.42
    mix_env = np.convolve(mix_env, np.ones(9600) / 9600, mode="same")
    out = reverb(music * mix_env[:, None], 3.2, 0.28) + reverb(fx, 2.2, 0.2) + reverb(voice, 0.5, 0.03)
    n_end = int(dur * SR)
    out = out[:n_end]
    fade = np.minimum(1, (n_end - np.arange(n_end)) / (0.5 * SR))
    out *= fade[:, None]
    out = np.tanh(out * 1.05)
    out /= np.abs(out).max() / 0.92
    write(out, "intro")


def outro():
    Q = json.loads((ASSETS / "outro-cues.json").read_text())
    dur = Q["duration"]
    music, fx, voice = bus(dur + 3), bus(dur + 3), bus(dur + 3)
    closing = load(ASSETS / "closing.mp3")
    beat = Q["panelLen"] / 4

    # --- four panels: a driving pulse, the harmony lifting at each cut
    chords = [[146.83, 220.0, 293.66, 369.99], [123.47, 185.0, 246.94, 293.66], [98.0, 146.83, 196.0, 293.66], [110.0, 164.81, 220.0, 277.18]]
    for i, p in enumerate(Q["panels"]):
        put(music, pad(chords[i], Q["panelLen"] + 0.5, cutoff=1100 + 350 * i, attack=0.05, release=0.45), p, 0.55)
        put(fx, thump(0.7), p)
        put(fx, riser(0.3), p - 0.3, 0.1)
        for b in range(4):
            if b:
                put(fx, thump(0.3), p + b * beat)
            for n in range(2):
                note = PENTA[(i * 2 + b * 2 + n * 3) % len(PENTA)]
                put(music, pluck(note), p + (b + n / 2) * beat, 0.16, pan=np.sin((b + n + i) * 1.4) * 0.5)

    # --- the thesis: everything drops away, then every school lights
    th, f = Q["thesis"], Q["flash"]
    put(fx, thump(0.85), th)
    put(music, pad([146.83, 220.0, 293.66, 369.99, 440.0], f - th + 1.0, cutoff=800, attack=1.8, release=0.6), th, 0.65)
    for _ in range(240):
        u = rng.random() ** 0.8
        n_ = rng.choice([1174.66, 1479.98, 1760.0, 2349.3, 2960.0, 3520.0])
        put(fx, bell(n_, 0.4), th + 0.5 + u * 2.6, 0.022, pan=rng.uniform(-0.9, 0.9))
    put(fx, riser(1.5), f - 1.5, 0.3)

    # --- the logo, and the closing line
    put(fx, thump(0.95), f)
    put(music, pad(D_MAJOR, dur - f + 2.2, cutoff=2400, attack=0.08, release=3.0), f, 0.9)
    for i, n_ in enumerate([587.33, 739.99, 880.0, 1174.66, 1479.98]):
        put(fx, bell(n_, 3.4), f + 0.06 * i, 0.22 - 0.03 * i, pan=-0.4 + 0.2 * i)
    put(voice, highpass(closing, 90), Q["voice"], 2.4)

    # --- mix
    mix_env = np.ones(len(music))
    a, b = int(Q["voice"] * SR), int((Q["voice"] + len(closing) / SR) * SR)
    mix_env[a:b] = 0.45
    mix_env = np.convolve(mix_env, np.ones(9600) / 9600, mode="same")
    x = reverb(music * mix_env[:, None], 3.2, 0.28) + reverb(fx, 2.2, 0.2) + reverb(voice, 0.7, 0.05)
    n_end = int(dur * SR)
    x = x[:n_end]
    x *= np.minimum(1, (n_end - np.arange(n_end)) / (1.0 * SR))[:, None]
    x = np.tanh(x * 1.05)
    x /= np.abs(x).max() / 0.92
    write(x, "outro")


def write(x, name):
    pcm = (x * 32767).astype(np.int16).tobytes()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ac", "2", "-ar", str(SR), "-i", "-", str(OUT / f"{name}.wav")], input=pcm, check=True)
    print("wrote", OUT / f"{name}.wav")


if __name__ == "__main__":
    globals()[sys.argv[1] if len(sys.argv) > 1 else "intro"]()
