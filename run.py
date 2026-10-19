#!/usr/bin/env python3
"""Start TripNest and PostgreSQL with Docker Compose."""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run TripNest and its PostgreSQL database with Docker Compose."
    )
    parser.add_argument(
        "--detach", "-d", action="store_true", help="Start in the background."
    )
    parser.add_argument(
        "--no-build", action="store_true", help="Reuse an existing web image."
    )
    args = parser.parse_args()

    docker = shutil.which("docker")
    if docker is None:
        print("Docker is not installed or is not on PATH.", file=sys.stderr)
        return 1

    env_path = PROJECT_DIR / ".env"
    if not env_path.exists():
        if env_path.is_symlink():
            print(".env is a broken symlink; fix it before starting.", file=sys.stderr)
            return 1
        example_path = PROJECT_DIR / ".env.example"
        try:
            with example_path.open("rb") as source, os.fdopen(
                os.open(env_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600),
                "wb",
            ) as destination:
                shutil.copyfileobj(source, destination)
        except OSError as error:
            print(f"Could not create .env: {error}", file=sys.stderr)
            return 1
        print("Created .env from .env.example (local demo configuration).")

    command = [docker, "compose", "up"]
    if not args.no_build:
        command.append("--build")
    if args.detach:
        command.append("--detach")

    print("Starting TripNest at http://localhost:3000", flush=True)
    try:
        return subprocess.run(command, cwd=PROJECT_DIR, check=False).returncode
    except KeyboardInterrupt:
        return 130
    except OSError as error:
        print(f"Could not start Docker Compose: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())


# dependencies can later be restored with npm ci