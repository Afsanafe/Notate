"""Run the shared backend, or open it inside a native desktop window."""

import argparse
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

import uvicorn

from .app import create_app


def default_data_dir():
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "Notate"
    if sys.platform == "win32":
        return Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "Notate"
    return Path(os.environ.get("XDG_DATA_HOME", str(Path.home() / ".local" / "share"))) / "notate"


def server_identity(url):
    try:
        with urllib.request.urlopen(url.rstrip("/") + "/api/health", timeout=0.5) as response:
            data = json.load(response)
            return data if data.get("app") == "notate" else None
    except (urllib.error.URLError, ValueError, OSError):
        return None


def main():
    parser = argparse.ArgumentParser(description="Notate — a local reading and annotation workspace")
    parser.add_argument("mode", choices=["serve", "desktop", "browser", "both"], nargs="?", default="serve")
    parser.add_argument("--host", default="127.0.0.1", help="Bind address; defaults to this computer only")
    parser.add_argument("--port", default=8765, type=int)
    parser.add_argument("--data-dir", type=Path, default=default_data_dir())
    parser.add_argument("--token", default=os.environ.get("NOTATE_TOKEN"), help="Workspace password (or set NOTATE_TOKEN)")
    parser.add_argument("--connect", help="Connect a desktop/browser client to an already running Notate URL")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("The port must be between 1 and 65535.")
    if args.host not in {"127.0.0.1", "localhost", "::1"} and not args.token:
        parser.error("Set NOTATE_TOKEN or --token when exposing the server beyond this computer.")
    if args.mode == "serve":
        if args.connect:
            parser.error("--connect is only available in desktop, browser, or both mode.")
        print(f"Workspace: {args.data_dir.resolve()}", flush=True)
        uvicorn.run(create_app(args.data_dir, args.token), host=args.host, port=args.port)
        return

    if args.mode in {"desktop", "both"}:
        try:
            import webview
        except ImportError:
            parser.exit(1, 'Desktop support is not installed. Run: python -m pip install -e ".[desktop]"\n')
    display_host = "127.0.0.1" if args.host == "0.0.0.0" else (f"[{args.host}]" if ":" in args.host else args.host)
    url = (args.connect or f"http://{display_host}:{args.port}").rstrip("/")
    server = None
    thread = None
    try:
        if not server_identity(url):
            if args.connect:
                parser.exit(1, f"No Notate server was found at {url}.\n")
            app = create_app(args.data_dir, args.token)
            server = uvicorn.Server(uvicorn.Config(app, host=args.host, port=args.port, log_level="warning"))
            thread = threading.Thread(target=server.run, daemon=True)
            thread.start()
            deadline = time.monotonic() + 10
            while not server.started and thread.is_alive() and time.monotonic() < deadline:
                time.sleep(0.05)
            if not server.started:
                parser.exit(1, f"Could not start the Notate server on port {args.port}. Try a different --port.\n")
            print(f"Notate is ready at {url}\nWorkspace: {args.data_dir.resolve()}", flush=True)
        else:
            print(f"Using the running Notate backend at {url}", flush=True)

        if args.mode in {"browser", "both"}:
            print(f"Opening your browser: {url}", flush=True)
            if not webbrowser.open(url, new=2):
                print(f"Open {url} in your browser to continue.", flush=True)
            if server:
                print("Keep this terminal open. Press Ctrl+C to stop the backend.", flush=True)

        if args.mode in {"desktop", "both"}:
            webview.create_window("Notate", url, width=1440, height=940, min_size=(900, 600),
                                  background_color="#f5f4ef", text_select=True)
            webview.start()
            if args.mode == "both" and server:
                print("Desktop closed. The browser backend is still running; press Ctrl+C to stop it.", flush=True)

        # In browser/both mode, closing a UI must not take away the browser's backend.
        if args.mode in {"browser", "both"} and thread:
            while thread.is_alive():
                thread.join(timeout=0.5)
    except KeyboardInterrupt:
        print("\nStopping this launcher's backend…" if server else "\nClosing this launcher…", flush=True)
    finally:
        if server:
            server.should_exit = True
            thread.join(timeout=5)


if __name__ == "__main__":
    main()
