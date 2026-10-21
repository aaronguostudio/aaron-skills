"""Optional offline Kokoro worker. JSON on stdin; WAV or voice list on stdout."""
import contextlib
import io
import json
import sys


def main():
    request = json.load(sys.stdin)
    # Keep dependency diagnostics away from the binary audio stream.
    with contextlib.redirect_stdout(sys.stderr):
        import numpy as np
        if request.get('action') == 'voices':
            with np.load(request['voices'], allow_pickle=False) as voices:
                result = json.dumps(sorted(voices.files)).encode()
        else:
            import soundfile as sf
            from kokoro_onnx import Kokoro
            engine = Kokoro(request['model'], request['voices'])
            samples, rate = engine.create(request['text'], voice=request['voice'],
                                          speed=request['speed'], lang=request['language'])
            audio = io.BytesIO()
            sf.write(audio, samples, rate, format='WAV', subtype='PCM_16')
            result = audio.getvalue()
    sys.stdout.buffer.write(result)


if __name__ == '__main__':
    main()
