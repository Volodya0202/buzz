import asyncio
import glob
import json
import os
import re
import shutil
import sqlite3
import sys
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
try:
    from gemini_webapi import GeminiClient
except ImportError:
    import subprocess
    sys.stderr.write("[GeminiBridge] gemini_webapi not found, auto-installing...\n")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "gemini-webapi"])
        from gemini_webapi import GeminiClient
    except Exception as e:
        sys.stderr.write(f"[GeminiBridge] Failed to auto-install gemini-webapi: {e}\n")

def get_firefox_cookies():
    profiles = glob.glob(os.path.expandvars(r'%APPDATA%\Mozilla\Firefox\Profiles\*.default*'))
    if not profiles:
        return {}
    src = os.path.join(profiles[0], 'cookies.sqlite')
    dst = os.path.join(os.environ['TEMP'], 'ff_bridge_cookies.sqlite')
    try:
        shutil.copy2(src, dst)
        conn = sqlite3.connect(dst)
        c = conn.cursor()
        c.execute("SELECT name, value FROM moz_cookies WHERE host LIKE '%google.com' AND name IN ('__Secure-1PSID', '__Secure-1PSIDTS', '__Secure-1PSIDCC')")
        cookies = dict(c.fetchall())
        conn.close()
        os.remove(dst)
        return cookies
    except Exception as e:
        print(f"Error reading Firefox cookies: {e}")
        return {}

cached_client = None

async def get_or_create_client(auth_header=None):
    global cached_client
    if cached_client is not None:
        return cached_client

    ff_cookies = get_firefox_cookies()
    psid = ff_cookies.get('__Secure-1PSID')
    psidts = ff_cookies.get('__Secure-1PSIDTS')
    psidcc = ff_cookies.get('__Secure-1PSIDCC')

    # If auth_header contains cookies, parse them
    if auth_header and "Bearer " in auth_header:
        token = auth_header.split("Bearer ", 1)[1].strip()
        if "__Secure-1PSID=" in token:
            for part in token.split(';'):
                part = part.strip()
                if part.startswith('__Secure-1PSID='):
                    psid = part.split('=', 1)[1]
                elif part.startswith('__Secure-1PSIDTS='):
                    psidts = part.split('=', 1)[1]
                elif part.startswith('__Secure-1PSIDCC='):
                    psidcc = part.split('=', 1)[1]
        elif token.startswith("g.a000"):
            psid = token

    client = GeminiClient(
        secure_1psid=psid,
        secure_1psidts=psidts,
        secure_1psidcc=psidcc,
    )
    await client.init(auto_refresh=True)
    cached_client = client
    return client

loop = asyncio.new_event_loop()
def run_loop():
    asyncio.set_event_loop(loop)
    loop.run_forever()

threading.Thread(target=run_loop, daemon=True).start()

class GeminiBridgeHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        sys.stderr.write(f"[GeminiBridge] {format % args}\n")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def do_GET(self):
        if self.path in ('/health', '/', '/v1/health'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"ok","bridge":"gemini-web"}')
        elif self.path in ('/v1/models', '/models'):
            models = {
                "object": "list",
                "data": [
                    {"id": "gemini-3.8-flash", "object": "model", "owned_by": "google"},
                    {"id": "gemini-2.0-flash", "object": "model", "owned_by": "google"},
                    {"id": "gemini-2.0-flash-thinking-exp", "object": "model", "owned_by": "google"},
                    {"id": "gemini-2.0-pro-exp", "object": "model", "owned_by": "google"},
                    {"id": "gemini-advanced", "object": "model", "owned_by": "google"},
                    {"id": "gemini-flash", "object": "model", "owned_by": "google"},
                    {"id": "gemini-1.5-pro", "object": "model", "owned_by": "google"},
                    {"id": "gemini-1.5-flash", "object": "model", "owned_by": "google"},
                ]
            }
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(models).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if not self.path.endswith('/chat/completions'):
            self.send_response(404)
            self.end_headers()
            return

        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        auth_header = self.headers.get('Authorization')

        try:
            req_json = json.loads(post_data.decode('utf-8'))
        except Exception as e:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": {"message": f"Invalid JSON: {e}"}}).encode('utf-8'))
            return

        messages = req_json.get('messages', [])
        tools = req_json.get('tools', [])
        model_name = req_json.get('model', 'gemini-advanced')

        # Check if this turn is an immediate follow-up after an auto-synthesized buzz messages send
        is_after_send = False
        if messages:
            last_msg = messages[-1]
            if last_msg.get("role") == "tool":
                for m in reversed(messages[:-1]):
                    if m.get("role") == "assistant":
                        for tc in m.get("tool_calls", []):
                            fn_args = tc.get("function", {}).get("arguments", "")
                            if "messages send" in fn_args:
                                is_after_send = True
                                break
                        break

        if is_after_send:
            print("[GeminiBridge] Follow-up turn after successful messages send. Completing turn.")
            openai_response = {
                "id": f"chatcmpl-gemini-{int(time.time()*1000)}",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": model_name,
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": "",
                        },
                        "finish_reason": "stop"
                    }
                ],
                "usage": {"prompt_tokens": 1, "completion_tokens": 0, "total_tokens": 1}
            }
            resp_bytes = json.dumps(openai_response).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(resp_bytes)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(resp_bytes)
            return

        # Find shell tool if available
        shell_tool_name = None
        if tools:
            for t in tools:
                t_name = t.get("function", {}).get("name", "")
                if t_name.endswith("__shell") or t_name == "shell":
                    shell_tool_name = t_name
                    break

        # Combine messages into prompt
        prompt_parts = []
        all_raw_text = []
        for msg in messages:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            if isinstance(content, list):
                part_texts = []
                for p in content:
                    if isinstance(p, dict) and p.get('type') == 'text':
                        part_texts.append(p.get('text', ''))
                content = "\n".join(part_texts)
            
            all_raw_text.append(str(content))
            if role == 'system':
                prompt_parts.append(f"[System Instruction: {content}]")
            elif role == 'user':
                prompt_parts.append(f"User: {content}")
            elif role == 'assistant':
                prompt_parts.append(f"Assistant: {content}")
            elif role == 'tool':
                prompt_parts.append(f"[Tool Result: {content}]")

        full_prompt = "\n\n".join(prompt_parts) if prompt_parts else "Hello"
        combined_history = "\n".join(all_raw_text)

        print(f"[GeminiBridge] Forwarding request to Gemini Web (prompt len={len(full_prompt)})...")

        async def execute():
            client = await get_or_create_client(auth_header)
            target_model = None
            m = model_name.lower()
            if "pro" in m or "advanced" in m:
                target_model = "gemini-pro"
            elif "flash" in m:
                target_model = "gemini-flash"
            response = await client.generate_content(full_prompt, model=target_model)
            return response.text

        future = asyncio.run_coroutine_threadsafe(execute(), loop)
        try:
            reply_text = future.result(timeout=60)
        except Exception as e:
            print(f"[GeminiBridge] Error generating content: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            err_resp = {"error": {"message": f"Gemini Web error: {str(e)}", "type": "gemini_error", "code": 500}}
            self.wfile.write(json.dumps(err_resp).encode('utf-8'))
            return

        tool_calls = []
        finish_reason = "stop"

        if shell_tool_name and reply_text and reply_text.strip():
            # 1. Check if model explicitly output a buzz messages send command
            cmd_match = re.search(r'(buzz\s+messages\s+send\s+.*?)(?:\n|$|```)', reply_text)
            if cmd_match:
                cmd = cmd_match.group(1).strip()
                tool_calls.append({
                    "id": f"call_send_{int(time.time()*1000)}",
                    "type": "function",
                    "function": {
                        "name": shell_tool_name,
                        "arguments": json.dumps({"command": cmd})
                    }
                })
                finish_reason = "tool_calls"
            else:
                # 2. Automatically wrap conversational text into buzz messages send
                ch_matches = re.findall(r'Channel:\s*(?:[^\n#]*#)?([0-9a-fA-F-]{36})', combined_history, re.IGNORECASE)
                rep_matches = re.findall(r'(?:--reply-to\s+|Thread root:\s*)([0-9a-fA-F]{64})', combined_history)
                if ch_matches:
                    channel_id = ch_matches[-1]
                    reply_to = rep_matches[-1] if rep_matches else None
                    reply_arg = f"--reply-to {reply_to} " if reply_to else ""
                    escaped_text = reply_text.replace("'", "'\\''")
                    cmd = f"printf '%s' '{escaped_text}' | buzz messages send --channel {channel_id} {reply_arg}--content -"
                    print(f"[GeminiBridge] Auto-publishing to channel {channel_id} (reply_to={reply_to})")
                    tool_calls.append({
                        "id": f"call_auto_send_{int(time.time()*1000)}",
                        "type": "function",
                        "function": {
                            "name": shell_tool_name,
                            "arguments": json.dumps({"command": cmd})
                        }
                    })
                    finish_reason = "tool_calls"

        msg_payload = {
            "role": "assistant",
            "content": reply_text,
        }
        if tool_calls:
            msg_payload["tool_calls"] = tool_calls

        openai_response = {
            "id": f"chatcmpl-gemini-{int(time.time()*1000)}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model_name,
            "choices": [
                {
                    "index": 0,
                    "message": msg_payload,
                    "finish_reason": finish_reason
                }
            ],
            "usage": {
                "prompt_tokens": max(1, len(full_prompt) // 4),
                "completion_tokens": max(1, len(reply_text) // 4),
                "total_tokens": max(2, (len(full_prompt) + len(reply_text)) // 4)
            }
        }

        resp_bytes = json.dumps(openai_response).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(resp_bytes)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(resp_bytes)
        print(f"[GeminiBridge] Successfully responded with {len(reply_text)} chars (tool_calls={len(tool_calls)}).")

if __name__ == '__main__':
    port = 20129
    server = HTTPServer(('127.0.0.1', port), GeminiBridgeHandler)
    print(f"Gemini Web Bridge listening on http://127.0.0.1:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
