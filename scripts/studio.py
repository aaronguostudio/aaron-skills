"""Resolve a read-only team template into local Film inputs."""

import argparse
import base64
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import ssl
import sys
import tempfile
import time
from urllib import error, parse, request
import uuid
import webbrowser

from platform_tools import default_root, private_path, installation_lock

SERVICE = "Aaron Skills Demo Studio"
PUBLIC_ORIGIN = "https://aaron-demo-studio.vercel.app"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def origin(value):
    parsed = parse.urlsplit(value)
    local = parsed.hostname in ("localhost", "127.0.0.1", "::1")
    if (
        (parsed.scheme != "https" and not (local and parsed.scheme == "http"))
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.path not in ("", "/")
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("Use the HTTPS origin of your team Studio.")
    return value.rstrip("/")


class RequestError(ValueError):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def call(base, route, body=None, credential=None):
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if credential:
        headers["Authorization"] = "Device " + credential
    req = request.Request(
        origin(base) + "/api/" + route,
        data=json.dumps(body or {}).encode(),
        headers=headers,
    )
    context = ssl.create_default_context()
    if sys.platform == "darwin" and Path("/etc/ssl/cert.pem").is_file():
        context.load_verify_locations("/etc/ssl/cert.pem")
    opener = request.build_opener(NoRedirect(), request.HTTPSHandler(context=context))
    try:
        with opener.open(req, timeout=20) as response:
            return json.loads(response.read(350000))
    except error.HTTPError as exc:
        try:
            msg = json.loads(exc.read(2000)).get("error", "Request failed")
        except ValueError:
            msg = "Request failed"
        raise RequestError(exc.code, str(msg)) from exc


def atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as f:
        tmp = Path(f.name)
        f.write(data)
    try:
        private_path(tmp)
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


def write_json(path, data):
    atomic(path, (json.dumps(data, indent=2) + "\n").encode())


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def credential(home, profile, action, value=None):
    if profile["vault"] == "file":
        path = home / (str(uuid.UUID(profile["slot"])) + ".key")
        if action == "save":
            atomic(path, value.encode())
        elif action == "delete":
            path.unlink(missing_ok=True)
        else:
            return path.read_text(encoding="utf-8")
        return None
    import keyring

    try:
        if action == "save":
            keyring.set_password(SERVICE, profile["slot"], value)
        elif action == "delete":
            keyring.delete_password(SERVICE, profile["slot"])
        else:
            value = keyring.get_password(SERVICE, profile["slot"])
            if not value:
                raise ValueError(
                    "Device credential unavailable. Reconnect Aaron Skills."
                )
            return value
    except keyring.errors.KeyringError as exc:
        raise ValueError(
            "Your OS credential store is unavailable. Unlock it and retry."
        ) from exc
    return None


def connect(home, args):
    base = origin(args.studio_url)
    if (home / "connection.json").exists():
        raise ValueError(
            "A workspace is already connected. Disconnect it before switching accounts."
        )
    key = secrets.token_hex(32)
    pairing = call(base, "pair", {"challenge": digest(key.encode())})
    url = base + "/connect#" + parse.quote(pairing["ticket"], safe=".")
    print(f"Open {url}\nEnter code {pairing['code']} in Studio.", flush=True)
    if not args.no_browser:
        webbrowser.open(url)
    expires = time.monotonic() + 600
    while time.monotonic() < expires:
        try:
            device = call(base, "device/status", credential=key)
            break
        except RequestError as exc:
            if exc.status != 401:
                raise
        time.sleep(2)
    else:
        raise ValueError("Connection expired. Start again.")
    profile = {
        "origin": base,
        "slot": str(uuid.uuid4()),
        "vault": "file" if args.file_credential else "system",
        **device,
    }
    with installation_lock(home):
        if (home / "connection.json").exists():
            call(base, "device/disconnect", credential=key)
            raise ValueError("Another connection completed first.")
        try:
            credential(home, profile, "save", key)
            write_json(home / "connection.json", profile)
        except Exception:
            call(base, "device/disconnect", credential=key)
            raise
    return {"connected": True, "workspace": device["workspace"], "name": device["name"]}


def checked_pack(payload, workspace):
    pack = json.loads(payload)
    if (
        pack.get("schema") != 1
        or pack.get("workspace") != workspace
        or not isinstance(pack.get("version"), int)
        or pack["version"] < 1
    ):
        raise ValueError("Unexpected template workspace or version.")
    uuid.UUID(pack["template"])
    source = pack["presentation"]
    # Rebuild a data-only Film configuration. Only a verified embedded PNG can become a local path.
    kit = source["brand"]
    colors = source["cover"]["colors"]
    if not all(
        re.fullmatch(r"#[a-fA-F0-9]{6}", c)
        for c in [
            kit["primary"],
            kit["accent"],
            *[colors[k] for k in ("background", "foreground", "accent")],
        ]
    ):
        raise ValueError("Invalid brand colors.")
    cover = source["cover"]["preset"]
    layout = source["layout"]["preset"]
    if cover not in (
        "cobalt-signal",
        "coral-aperture",
        "vermilion-fold",
    ) or layout not in ("studio-cobalt", "plain-caption", "screen-first"):
        raise ValueError("This template needs a compatible Aaron Skills release.")
    if not all(
        isinstance(s, str) and 0 < len(s) <= 120 for s in (source["title"], kit["name"])
    ):
        raise ValueError("Invalid template title or brand.")
    brand = {k: kit[k] for k in ("name", "primary", "accent")}
    logo = None
    if pack.get("logo"):
        logo = base64.b64decode(pack["logo"], validate=True)
        if len(logo) > 98304 or not logo.startswith(b"\x89PNG\r\n\x1a\n"):
            raise ValueError("Invalid team logo.")
        brand.update(
            logo="logo.png",
            logoProvenance={
                "source": "Workspace brand kit",
                "role": "corporate",
                "verified": True,
            },
        )
    else:
        brand["fallback"] = "monogram"
    presentation = {
        "version": 2,
        "title": source["title"],
        "brand": brand,
        "intro": {"enabled": True},
        "cover": {
            "preset": cover,
            "colors": {k: colors[k] for k in ("background", "foreground", "accent")},
        },
        "layout": {"preset": layout},
    }
    return pack, presentation, logo


def resolve(home, profile, args):
    project = Path(args.project).resolve()
    if not project.is_dir():
        raise ValueError("Select an existing local project directory.")
    lock = project / ".studio-release.json"
    prior = read(lock) if lock.exists() else None
    if prior and (
        prior.get("workspace") != profile["workspace"]
        or prior.get("origin") != profile["origin"]
    ):
        raise ValueError("This project is pinned to another workspace.")
    if args.template and prior and args.template != prior["template"]:
        raise ValueError("This project is already pinned to a different template.")
    cache = home / "cache" / str(uuid.UUID(profile["slot"]))
    if args.offline:
        if profile.get("accessDenied"):
            raise ValueError(
                "The last online check denied access. Reconnect to the team."
            )
        if not prior or not re.fullmatch(r"[0-9a-f]{64}", prior.get("sha256", "")):
            raise ValueError("This project needs one online template resolution first.")
        if datetime.fromisoformat(
            profile["expires"].replace("Z", "+00:00")
        ) <= datetime.now(timezone.utc):
            raise ValueError("Device authorization has expired. Reconnect online.")
        expected = prior["sha256"]
        payload = (cache / expected / "pack.json").read_bytes()
    else:
        params = (
            {"template": prior["template"], "version": prior["version"]}
            if prior
            else {"template": args.template}
        )
        response = call(
            profile["origin"],
            "device/resolve",
            params,
            credential(home, profile, "get"),
        )
        payload = response["payload"].encode()
        expected = response["sha256"]
    if digest(payload) != expected or prior and expected != prior["sha256"]:
        raise ValueError("Template content did not match its immutable release.")
    pack, presentation, logo = checked_pack(payload, profile["workspace"])
    if prior and (prior["template"], prior["version"]) != (
        pack["template"],
        pack["version"],
    ):
        raise ValueError("The resolved revision does not match the project pin.")
    directory = cache / expected
    atomic(directory / "pack.json", payload)
    if logo:
        atomic(directory / "logo.png", logo)
    write_json(directory / "presentation.json", presentation)
    pin = {k: pack[k] for k in ("workspace", "template", "version")}
    pin.update(origin=profile["origin"], sha256=expected)
    if not prior:
        write_json(lock, pin)
    return {
        **pin,
        "presentation": str(directory / "presentation.json"),
        "offline": args.offline,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(prog="aaron-demo studio")
    sub = parser.add_subparsers(dest="action", required=True)
    enroll = sub.add_parser("connect")
    enroll.add_argument("--studio-url", default=PUBLIC_ORIGIN)
    enroll.add_argument("--no-browser", action="store_true")
    enroll.add_argument(
        "--file-credential",
        action="store_true",
        help="Use an owner-only credential file on a headless computer",
    )
    sub.add_parser("status")
    sub.add_parser("disconnect")
    p = sub.add_parser("resolve")
    p.add_argument("--project", required=True)
    p.add_argument("--template")
    p.add_argument("--offline", action="store_true")
    args = parser.parse_args(argv)
    home = Path(os.environ.get("AARON_STUDIO_HOME", default_root().parent / "studio"))
    home.mkdir(parents=True, exist_ok=True, mode=0o700)
    private_path(home, directory=True)
    path = home / "connection.json"
    if args.action == "connect":
        return connect(home, args)
    if not path.exists():
        if args.action == "status":
            return {"connected": False}
        raise ValueError("Connect Aaron Skills to your workspace first.")
    with installation_lock(home):
        profile = read(path)
        if args.action == "disconnect":
            try:
                call(
                    profile["origin"],
                    "device/disconnect",
                    credential=credential(home, profile, "get"),
                )
            except RequestError as exc:
                if exc.status != 401:
                    raise
            credential(home, profile, "delete")
            path.unlink()
            return {"connected": False}
        try:
            if args.action == "status":
                result = {
                    "connected": True,
                    **call(
                        profile["origin"],
                        "device/status",
                        credential=credential(home, profile, "get"),
                    ),
                }
            else:
                result = resolve(home, profile, args)
        except RequestError as exc:
            if exc.status in (401, 403):
                profile["accessDenied"] = True
                write_json(path, profile)
            raise
        if profile.get("accessDenied") and not getattr(args, "offline", False):
            profile.pop("accessDenied")
            write_json(path, profile)
        return result


if __name__ == "__main__":
    try:
        print(json.dumps(main(), indent=2))
    except (OSError, ValueError, KeyError, TypeError) as exc:
        sys.exit(f"aaron-demo studio: {exc}")
