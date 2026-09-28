#!/usr/bin/env bash
# Reload the scene and report any geometry with NaN/zero normals.
set -e
cd "$(dirname "$0")/.."
AB="agent-browser --session pelican"
$AB open "http://127.0.0.1:4173/?t=$(date +%s)" >/dev/null 2>&1
$AB wait --fn "window.__pelican !== undefined" >/dev/null 2>&1 || true
$AB wait 1200 >/dev/null 2>&1 || true
$AB eval "
(() => {
  const p = window.__pelican;
  const bad = [];
  p.scene.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.normal) return;
    const n = o.geometry.attributes.normal;
    let nan = 0, zero = 0;
    for (let i=0;i<n.count;i++) {
      const l = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
      if (!Number.isFinite(l)) nan++; else if (l < 1e-6) zero++;
    }
    if (nan || zero) bad.push((o.name||o.type)+' nan='+nan+' zero='+zero);
  });
  return bad.length ? 'BAD:\n'+bad.join('\n') : 'ALL NORMALS CLEAN';
})()" 2>&1 | tail -8
$AB errors 2>&1 | tail -5
