#!/usr/bin/env python3
"""
One-off: replay Echo Maze into 900 commits (30/day × 30 days).

Use --push and --remote so each commit is pushed immediately → 900 pushes
(~30 pushes per day across 30 days on GitHub activity).

Run from repo root:
  python3 scripts/bake-history.py --push --remote git@github.com:USER/game-echo-maze.git

Requires: git, project files present. Deletes existing .git (destructive).
Use an empty GitHub repo or delete the remote branch first so pushes succeed.
"""
from __future__ import annotations

import argparse
import os
import random
import shutil
import subprocess
import time
from datetime import datetime, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
START_DAY = datetime(2026, 4, 4, 8, 45, 0)
AUTHOR_NAME = "Fitsum Mehari"
AUTHOR_EMAIL = "FitsumMehari@users.noreply.github.com"

FILE_GROUPS: list[tuple[list[str], str]] = [
    (["package.json", ".gitignore"], "chore: scaffold package and ignore rules"),
    (["tsconfig.json", "vite.config.ts"], "build: TypeScript and Vite baseline"),
    (["index.html"], "feat: HTML shell and mount point"),
    (["public/favicon.svg", "public/icons.svg"], "assets: favicon and icon sheet"),
    (["src/constants.ts"], "feat: world tuning constants"),
    (["src/format.ts", "src/settings.ts"], "feat: time formatting and persisted settings"),
    (["src/level.ts", "src/levelData.ts"], "feat: ASCII level parsing and sample maze"),
    (["src/collision.ts"], "feat: circle-vs-cell collision"),
    (["src/pulseSystem.ts"], "feat: echo pulse ring bookkeeping"),
    (["src/audioEngine.ts"], "feat: procedural Web Audio cues"),
    (["src/worldGeometry.ts"], "feat: merged mesh and echo sphere geometry"),
    (["src/shaders/worldShader.ts"], "feat: WebGL2 echo reveal shaders"),
    (["src/game.ts"], "feat: player loop, hunters, hazards, win/lose"),
    (["src/main.ts"], "feat: menus, HUD, input and render loop"),
    (["src/style.css"], "style: overlays, HUD, and fatal states"),
    (["README.md"], "docs: readme and deploy notes"),
    (["package-lock.json"], "chore: lock dependencies"),
    (["src/levelGenerator.ts"], "feat: procedural large maze generation"),
    (["src/assets/hero.png"], "assets: hero banner image"),
    (["src/assets/typescript.svg", "src/assets/vite.svg"], "assets: stack badge SVGs"),
]

LOG_PREFIXES = [
    "wip:",
    "tweak:",
    "polish:",
    "debug:",
    "test:",
    "note:",
    "refactor:",
    "perf:",
    "audio:",
    "shader:",
    "ui:",
    "balance:",
    "playtest:",
]

LOG_TOPICS = [
    "footstep pulse gain",
    "harmonic ping spacing",
    "echo debt decay",
    "hunter seek curve",
    "hazard reset flow",
    "door/switch affordance",
    "pointer lock + pause edge case",
    "touch look sensitivity",
    "resonance charge curve",
    "silence dividend gate",
    "ringwell absorption",
    "decoy wall shader lie",
    "exit seal denial cue",
    "fog density vs maze size",
    "camera far plane",
    "merged geometry bounds",
    "enemy mesh batching",
    "projectile bounce damping",
    "throw cooldown feel",
    "menu copy clarity",
    "win/lose overlay timing",
    "WebGL context lost copy",
    "mobile drag look",
    "keyboard repeat guard",
    "volume ramp on resume",
    "stereo ping pan width",
    "harmonic twin-ring decay",
    "tile absorption tuning",
    "spawn pulse on restart",
    "sector HUD readability",
]


def git_env(dt: datetime) -> dict[str, str]:
    ds = dt.strftime("%Y-%m-%d %H:%M:%S")
    e = os.environ.copy()
    e["GIT_AUTHOR_DATE"] = ds
    e["GIT_COMMITTER_DATE"] = ds
    return e


def run_git(args: list[str], dt: datetime | None = None) -> None:
    env = git_env(dt) if dt else os.environ.copy()
    env.setdefault("GIT_AUTHOR_NAME", AUTHOR_NAME)
    env.setdefault("GIT_AUTHOR_EMAIL", AUTHOR_EMAIL)
    subprocess.run(
        ["git", "-c", f"user.name={AUTHOR_NAME}", "-c", f"user.email={AUTHOR_EMAIL}", *args],
        cwd=ROOT,
        env=env,
        check=True,
    )


def commit_time(day_index: int, slot: int) -> datetime:
    """Human-ish spread: mornings and evenings, uneven minutes."""
    base = START_DAY + timedelta(days=day_index)
    rng = random.Random(day_index * 1000 + slot)
    hour = rng.choice([9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22])
    minute = rng.randint(0, 59)
    second = rng.randint(0, 59)
    return base.replace(hour=hour, minute=minute, second=second)


def log_message(index: int) -> str:
    rng = random.Random(index + 404)
    p = rng.choice(LOG_PREFIXES)
    t = rng.choice(LOG_TOPICS)
    return f"{p} {t}"


def append_session_line(path: str, line: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.isfile(path):
        with open(path, "w", encoding="utf-8") as f:
            f.write("# Session log\n\n")
    with open(path, "a", encoding="utf-8") as f:
        f.write(f"- {line}\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Bake 900 dated commits; optional push after each.")
    parser.add_argument(
        "--push",
        action="store_true",
        help="Run git push after every commit (900 pushes ≈ 30/day for 30 days).",
    )
    parser.add_argument(
        "--remote",
        type=str,
        default=None,
        metavar="URL",
        help="Git remote URL for origin (required with --push unless origin already exists).",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.08,
        metavar="SEC",
        help="Sleep between pushes to reduce GitHub rate-limit risk (default: 0.08).",
    )
    args = parser.parse_args()

    if args.push and not args.remote:
        parser.error("--push requires --remote <url> because this script removes .git and re-inits (e.g. git@github.com:USER/repo.git)")

    os.chdir(ROOT)
    git_dir = os.path.join(ROOT, ".git")
    if os.path.isdir(git_dir):
        shutil.rmtree(git_dir)

    subprocess.run(["git", "init", "-b", "main"], cwd=ROOT, check=True)

    if args.push and args.remote:
        subprocess.run(["git", "remote", "add", "origin", args.remote], cwd=ROOT, check=True)

    assert len(FILE_GROUPS) == 20
    random.seed(42)

    for k in range(900):
        day = k // 30
        slot = k % 30
        dt = commit_time(day, slot)

        if k < 20:
            paths, msg = FILE_GROUPS[k]
            missing = [p for p in paths if not os.path.isfile(os.path.join(ROOT, p))]
            if missing:
                raise SystemExit(f"Missing files for batch {k}: {missing}")
            run_git(["add", "--"] + paths, dt)
            run_git(["commit", "-m", msg], dt)
        else:
            line = f"{log_message(k)} (day {day + 1})"
            log_path = os.path.join(ROOT, "docs", "session-log.md")
            append_session_line(log_path, line)
            run_git(["add", "docs/session-log.md"], dt)
            run_git(["commit", "-m", log_message(k)], dt)

        if args.push:
            if args.delay > 0:
                time.sleep(args.delay)
            if k == 0:
                subprocess.run(["git", "push", "-u", "origin", "main"], cwd=ROOT, check=True)
            else:
                subprocess.run(["git", "push"], cwd=ROOT, check=True)

    print("Done: 900 commits on main.", end=" ")
    if args.push:
        print("(900 pushes — about 30 per day × 30 days.)")
    else:
        print("Use --push --remote <url> for 900 pushes (30/day × 30 days) on GitHub.")


if __name__ == "__main__":
    main()
