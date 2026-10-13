"""Verify launcher readiness, server ownership, and UI close behavior."""

import json
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pytest


ROOT = Path(__file__).resolve().parents[1]


def free_port():
    with socket.socket() as handle:
        handle.bind(('127.0.0.1', 0))
        return handle.getsockname()[1]


def wait_until(predicate, seconds=10):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(.05)
    raise AssertionError('Launcher did not reach the expected state.')


def healthy(url):
    try:
        return httpx.get(url + '/api/health', timeout=.2).status_code == 200
    except httpx.HTTPError:
        return False


def stop(process):
    if process.poll() is None:
        process.send_signal(signal.SIGINT)
        try:
            process.wait(timeout=8)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


def run_client(mode, port, workspace, report):
    # Keep the actual HTTP backend and CLI lifecycle; replace only OS UI calls.
    # This lets the test simulate closing a window without opening user apps.
    code = '''
import json, pathlib, sys, types
import httpx
from notate import cli
report = pathlib.Path(sys.argv[1])
events = []
def record(event, url=None):
    events.append({'event': event, 'url': url, 'ready': bool(url and httpx.get(url + '/api/health').status_code == 200)})
    report.write_text(json.dumps(events))
def open_browser(url, **kwargs):
    record('browser', url)
    return True
def create_window(title, url, **kwargs):
    record('desktop', url)
sys.modules['webview'] = types.SimpleNamespace(create_window=create_window, start=lambda: record('desktop_closed'))
cli.webbrowser.open = open_browser
sys.argv = ['notate', *sys.argv[2:]]
cli.main()
'''
    return subprocess.Popen([sys.executable, '-c', code, str(report), mode, '--port', str(port), '--data-dir', str(workspace)],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


@pytest.mark.parametrize('mode', ['browser', 'both'])
def test_browser_modes_keep_owned_backend_until_ctrl_c(tmp_path, mode):
    port = free_port()
    url = f'http://127.0.0.1:{port}'
    report = tmp_path / 'events.json'
    process = run_client(mode, port, tmp_path / 'workspace', report)
    try:
        wait_until(lambda: report.exists() and ('desktop_closed' in report.read_text() if mode == 'both' else 'browser' in report.read_text()))
        events = json.loads(report.read_text())
        browser = next(event for event in events if event['event'] == 'browser')
        assert browser['url'] == url and browser['ready']
        assert healthy(url)
        assert process.poll() is None, 'The browser backend must survive a desktop close.'
    finally:
        stop(process)
    assert process.returncode == 0
    assert not healthy(url)


def test_desktop_only_stops_backend_it_started(tmp_path):
    port = free_port()
    url = f'http://127.0.0.1:{port}'
    report = tmp_path / 'events.json'
    process = run_client('desktop', port, tmp_path / 'workspace', report)
    try:
        assert process.wait(timeout=10) == 0
        events = json.loads(report.read_text())
        assert events[0]['event'] == 'desktop' and events[0]['ready']
        assert not any(event['event'] == 'browser' for event in events)
        assert not healthy(url)
    finally:
        stop(process)


def test_all_clients_reuse_and_leave_existing_backend_running(tmp_path):
    port = free_port()
    url = f'http://127.0.0.1:{port}'
    server = subprocess.Popen([sys.executable, '-m', 'notate', 'serve', '--port', str(port), '--data-dir', str(tmp_path / 'original')],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        wait_until(lambda: healthy(url))
        instance = httpx.get(url + '/api/health').json()['instance']
        for mode in ('browser', 'desktop', 'both'):
            other_workspace = tmp_path / f'ignored-{mode}'
            report = tmp_path / f'{mode}.json'
            process = run_client(mode, port, other_workspace, report)
            try:
                assert process.wait(timeout=10) == 0
                assert not other_workspace.exists(), 'Reusing a server should not create another workspace.'
                assert httpx.get(url + '/api/health').json()['instance'] == instance
                assert all(event['ready'] for event in json.loads(report.read_text()) if event['url'])
            finally:
                stop(process)
    finally:
        stop(server)


def test_scripts_accept_options_when_started_from_another_directory(tmp_path):
    for filename in ('start_desktop.sh', 'start_browser.sh', 'start_both.sh', 'Notate Desktop.command', 'Notate Web.command', 'Notate Both.command'):
        result = subprocess.run([str(ROOT / filename), '--help'], cwd=tmp_path, text=True, capture_output=True, timeout=10)
        assert result.returncode == 0, result.stderr
        assert '--data-dir' in result.stdout and '--port' in result.stdout
