"""Generate STT test audio samples (mp3) using Microsoft Edge TTS voices.

Outputs:
  src/public/audio-samples/sr_female.mp3
  src/public/audio-samples/sr_male.mp3
  src/public/audio-samples/en_female.mp3
  src/public/audio-samples/en_male.mp3
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import edge_tts

OUT_DIR = Path("src/public/audio-samples")

SAMPLES = [
    {
        "filename": "sr_female.mp3",
        "voice": "sr-RS-SophieNeural",
        "text": "Zdravo. Ovo je test govora na srpskom jeziku. Danas proveravamo kvalitet prepoznavanja govora u realnom vremenu.",
        "rate": "-12%",
    },
    {
        "filename": "sr_male.mp3",
        "voice": "sr-RS-NicholasNeural",
        "text": "Dobro jutro. Ovo je muški glas na srpskom jeziku, za testiranje tačnosti STT sistema i završne obrade transkripta.",
        "rate": "-12%",
    },
    {
        "filename": "en_female.mp3",
        "voice": "en-US-JennyNeural",
        "text": "Hello. This is an English female voice sample for real-time speech to text testing.",
        "rate": "-5%",
    },
    {
        "filename": "en_male.mp3",
        "voice": "en-US-GuyNeural",
        "text": "Hi there. This is an English male voice sample to evaluate STT quality and latency.",
        "rate": "-5%",
    },
]


async def generate_one(sample: dict) -> None:
    out_path = OUT_DIR / sample["filename"]
    communicate = edge_tts.Communicate(
        text=sample["text"],
        voice=sample["voice"],
        rate=sample.get("rate", "+0%"),
    )
    await communicate.save(str(out_path))
    print(f"generated: {out_path}")


async def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    await asyncio.gather(*(generate_one(sample) for sample in SAMPLES))


if __name__ == "__main__":
    asyncio.run(main())
