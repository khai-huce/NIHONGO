# DaKanji handwriting assets

Upstream: https://github.com/dariyooo/DaKanji-Single-Kanji-Recognition
Release: https://github.com/dariyooo/DaKanji-Single-Kanji-Recognition/releases/tag/v2.0
Fetched: 2026-10-28. Keep the exact bytes and labels paired; do not replace one alone.

Files extracted from official release assets:
- `char_classifier_onnx.zip` → `char_classifier.onnx`, 2,230,001 bytes, SHA-256 `2c8d334e1541720dd1f8603a9dc3ecd270842756c99fbe24ce2de3e925e1f4a7`.
- `char_classifier_labels.zip` → `char_classifier_labels.txt`, 19,521 bytes, SHA-256 `a3b26bee5c6b37f3e76f802c8012c6b00c0dfbcda90de1a208d62386b2c6b3ba`.

The release README explicitly offers pretrained models for use in software and requests attribution. The repository LICENSE at tag v2.0 is MIT (Copyright 2021 CaptainDario); copied in `LICENSE`. No separate model license was included in the release archives. This records the upstream grant, not an independent review of training-data rights. Upstream credits ETL Character Database and KanjiVG for training data; this project distributes the released inference model, not those training datasets.

Attribution shown in the UI: Character recognition powered by DaKanji / CaptainDario (DaAppLab).

ONNX Runtime input `image`: float32 [1,1,64,64], white foreground on black, 0–255. Output `probs`: [1,6507]. Labels file is a contiguous UTF-8 character sequence, **not** newline-separated. Preserve order. Runtime validates both hashes and label count. NIHONGO keeps only Han candidates and resolves published knowledge from its existing database.

No retraining, automatic asset downloads at runtime, cloud inference or per-call fee. Read `docs/HANDWRITING.md` for limits and deployment.
