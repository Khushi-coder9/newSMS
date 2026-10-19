import json
import urllib.error
import urllib.request

cfg = open(r"d:\downloads\StudentMS\config.js", encoding="utf-8").read()
key = cfg.split("GEMINI_API_KEY:")[1].split('"')[1]
print("key_prefix", key[:6], "len", len(key))

headers = {"Content-Type": "application/json", "x-goog-api-key": key}
tiny = json.dumps({
    "contents": [{"parts": [{"text": "Say ok"}]}]
}).encode()

checks = [
    ("GET models", "GET", "https://generativelanguage.googleapis.com/v1beta/models", None),
    ("gc 3.5-flash-lite header", "POST", "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent", tiny),
    ("gc 3.5-flash-lite query", "POST", "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=" + key, tiny),
]

for name, method, url, body in checks:
    h = dict(headers)
    if "key=" in url:
        h.pop("x-goog-api-key", None)
    req = urllib.request.Request(url, data=body, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=25) as res:
            raw = res.read().decode("utf-8", "replace")
        print("\n==", name, "OK", res.status, raw[:300].replace("\n", " "))
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", "replace")
        print("\n==", name, "HTTP", err.code)
        try:
            data = json.loads(raw)
            errinfo = data.get("error", {})
            print("message:", errinfo.get("message", "")[:400])
            print("status:", errinfo.get("status"))
            details = errinfo.get("details") or []
            for item in details:
                meta = item.get("metadata") or {}
                if meta:
                    print("quota_limit:", meta.get("quota_limit"))
                    print("quota_limit_value:", meta.get("quota_limit_value"))
                    print("quota_location:", meta.get("quota_location"))
                    print("quota_metric:", meta.get("quota_metric"))
        except Exception:
            print(raw[:500])
    except Exception as err:
        print("\n==", name, type(err).__name__, str(err)[:200])
