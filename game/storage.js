/**
 * Saving. On the hosted page the save lives in the page's database, in the
 * player's own private space, so it follows them between devices. Opened
 * from the repository, it falls back to the browser's local storage.
 *
 * Saves are compacted: each tile's 36 squares become one short string.
 */

import { PREGENS } from "./data/party.js";
import { ensureStores, outfit } from "./supplies.js";
import { ensureAdvancement } from "./advance.js";

const LOCAL_KEY = "mastery-solo-save-v2";
const FLAGS = ["road", "river", "lake"];

export function pack(state) {
  const s = structuredClone(state);
  for (const t of Object.values(s.world.tiles)) {
    t.sq = t.sq.map(c => String.fromCharCode(48 + FLAGS.reduce((n, f, i) => n | (c[f] ? 1 << i : 0), 0))).join("");
  }
  s.log = s.log.slice(-120);
  return JSON.stringify(s);
}

export function unpack(json) {
  const s = JSON.parse(json);
  for (const t of Object.values(s.world.tiles)) {
    if (typeof t.sq === "string") t.sq = [...t.sq].map(ch => { const n = ch.charCodeAt(0) - 48; return Object.fromEntries(FLAGS.map((f, i) => [f, !!(n & (1 << i))])); });
  }
  s.world.places ??= {};
  // Saves from before a field existed pick it up from the starting roster.
  for (const m of s.party?.members || []) {
    const p = PREGENS.find(x => x.id === m.id);
    if (p && m.mp === undefined) m.mp = p.magan;
    if (p) for (const k of ["spells", "gear", "shieldAbsorbs", "abilities", "immune", "casting", "companion", "theurgy"]) if (m[k] === undefined && p[k] !== undefined) m[k] = structuredClone(p[k]);
    if (m.companion && m.companion.hp === undefined) m.companion.hp = m.companion.health;
    if (p?.casting?.recorded && m.casting && !m.casting.recorded) m.casting.recorded = structuredClone(p.casting.recorded);
  }
  // Saves from before supplies set out with what a new party has.
  if (s.party && !s.party.food) outfit(s);
  for (const m of s.party?.members || []) ensureAdvancement(m);
  // Saves from before armor knew its weight class carried the Agility tier baked in.
  for (const m of s.party?.members || []) if (m.armor && !m.armor.weightClass) {
    m.armor.weightClass = "light";
    const t = 1 + Math.min(Math.floor(m.attributes.agility / 5), 12);
    for (const k of Object.keys(m.armor.resistance)) m.armor.resistance[k] = Math.max(0, m.armor.resistance[k] - t);
  }
  if (s.party) { ensureStores(s); s.party.roles = { forager: null, cook: null, healer: null, smith: null, ...s.party.roles }; }
  return s;
}

/** Resolves to { load(), save(state), where } once it knows where saves go. */
export async function openStorage() {
  const local = {
    where: "this browser",
    async load() { try { const j = localStorage.getItem(LOCAL_KEY); return j ? unpack(j) : null; } catch { return null; } },
    async save(state) { try { localStorage.setItem(LOCAL_KEY, pack(state)); } catch { /* private window: play on without saving */ } }
  };
  if (!window.claude?.use) return local;
  try {
    const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
    if (!db || !user) return local;
    const id = await user.id();
    if (!id) return local;
    const doc = db.collection(`data/users/${id}`).doc("save");
    let pending = null, writing = false;
    const flush = async () => {
      if (writing || !pending) return;
      writing = true;
      const json = pending; pending = null;
      try { await doc.set({ json, savedAt: Date.now() }); } catch { await local.save(unpack(json)); }
      writing = false;
      if (pending) flush();
    };
    return {
      where: "your account",
      async load() {
        try { const snap = await doc.get(); return snap.exists ? unpack(snap.data().json) : await local.load(); } catch { return local.load(); }
      },
      async save(state) {
        pending = pack(state);
        local.save(state);
        setTimeout(flush, 400);
      }
    };
  } catch { return local; }
}
