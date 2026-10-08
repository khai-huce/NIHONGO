"""One bounded stdin JSON request; only measured MP3 metadata goes to stdout.

The web server chooses the directory and voice. Text never appears in argv/logs.
Each sentence is a separate real media file, so seeking/highlighting needs no
guessed speech marks. TLS verification remains enabled by edge-tts.
"""
import asyncio
import json
import math
from pathlib import Path
import sys

import edge_tts
from mutagen.mp3 import MP3


async def main():
    payload = json.loads(sys.stdin.buffer.read(100_001).decode("utf-8"))
    sentences = payload["sentences"]
    if payload["voice"] not in ("ja-JP-NanamiNeural", "ja-JP-KeitaNeural"):
        raise ValueError("voice")
    if not sentences or len(sentences) > 300 or sum(len(item["text"]) for item in sentences) > 3000:
        raise ValueError("limit")
    directory = Path(payload["directory"])
    directory.mkdir(parents=True, exist_ok=True)
    result, offset = [], 0.0
    for index, sentence in enumerate(sentences):
        filename = f"{index}.mp3"
        target = directory / filename
        await edge_tts.Communicate(sentence["text"], payload["voice"], connect_timeout=10, receive_timeout=30).save(str(target))
        duration = MP3(target).info.length
        if not math.isfinite(duration) or duration <= 0 or target.stat().st_size > 20_000_000:
            raise ValueError("media")
        result.append({"sentenceId": sentence["id"], "fileName": filename, "durationSec": duration, "offsetSec": offset})
        offset += duration
    print(json.dumps({"segments": result, "totalSeconds": offset}, ensure_ascii=True))


if __name__ == "__main__":
    try:
        asyncio.run(asyncio.wait_for(main(), timeout=170))
    except Exception as error:
        # Provider exceptions can contain user text or URLs; report the type only.
        print(type(error).__name__, file=sys.stderr)
        sys.exit(1)
