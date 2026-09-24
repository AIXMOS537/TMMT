#!/usr/bin/env python3
"""Ask the local brain. Semantic search over the ingested corpus.

  python3 askbrain.py "how do I dispute a collection account"
  python3 askbrain.py --stats
"""
import json
import math
import sys
import urllib.request

VEC = "/Users/projectaixmos01/.config/tmmt/rick-desk/knowledge/vectors.jsonl"
OLLAMA = "http://127.0.0.1:11434/api/embeddings"
MODEL = "nomic-embed-text"


def embed(text):
    req = urllib.request.Request(
        OLLAMA,
        data=json.dumps({"model": MODEL, "prompt": text}).encode(),
        headers={"Content-Type": "application/json"},
    )
    return json.load(urllib.request.urlopen(req, timeout=90))["embedding"]


def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb + 1e-9)


def load():
    rows = []
    with open(VEC, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except ValueError:
                continue
            if obj.get("vec"):
                rows.append((obj["vec"], obj.get("src", "?"), obj.get("text") or ""))
    return rows


def main():
    rows = load()

    if len(sys.argv) > 1 and sys.argv[1] == "--stats":
        by_src = {}
        for _, src, text in rows:
            by_src[src] = by_src.get(src, [0, 0])
            by_src[src][0] += 1
            by_src[src][1] += len(text)
        print("corpus: %d chunks from %d sources\n" % (len(rows), len(by_src)))
        credit = [s for s in by_src if s.startswith("CREDIT__")]
        print("  credit sources: %d" % len(credit))
        print("  other sources:  %d\n" % (len(by_src) - len(credit)))
        for src in sorted(by_src, key=lambda s: -by_src[s][0])[:14]:
            n, chars = by_src[src]
            print("   %3d chunks  %7d chars  %s" % (n, chars, src))
        return

    query = " ".join(sys.argv[1:]) or "credit dispute"
    qv = embed(query)
    scored = sorted(((cosine(qv, v), s, t) for v, s, t in rows), reverse=True)

    print("corpus: %d chunks    query: %s\n" % (len(rows), query))
    for score, src, text in scored[:3]:
        snippet = " ".join(text.split())[:200]
        print("  [%.3f] %s" % (score, src))
        print("         %s...\n" % snippet)


if __name__ == "__main__":
    main()
