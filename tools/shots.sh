#!/usr/bin/env bash
# Capture the scene from a few fixed angles for review.
# Uses a dedicated browser session so the user's own tabs stay untouched.
# usage: tools/shots.sh <tag>
set -e
cd "$(dirname "$0")/.."
AB="agent-browser --session pelican"
TAG="${1:-shot}"
URL="http://127.0.0.1:4173/?t=$(date +%s)"
$AB open "$URL" >/dev/null 2>&1
$AB wait --fn "window.__pelican !== undefined" >/dev/null 2>&1 || true
$AB wait 1500 >/dev/null 2>&1 || true

shoot () { # name  pos  target
  $AB eval "window.__pelican.view([$2],[$3])" >/dev/null 2>&1
  $AB wait 500 >/dev/null 2>&1 || true
  $AB screenshot "shots/${TAG}-$1.png" 2>&1 | tail -1
}

shoot hero   "2.78,1.98,3.92" "0.02,1.0,0"
shoot side   "0.0,1.35,5.0"   "0.0,1.15,0"
shoot front  "4.6,1.6,1.1"    "0.1,1.15,0"
shoot low    "3.1,0.55,3.0"   "0.0,0.85,0"
shoot close  "1.55,1.72,1.75" "0.18,1.5,0"
shoot bike   "0.2,0.95,2.6"   "0.0,0.75,0"
