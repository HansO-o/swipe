// notes.js — the app's data: notes in localStorage, as a store React can subscribe to.
// Works offline by construction; other tabs of the app stay in sync via the 'storage' event.

import { useSyncExternalStore } from 'react';

const KEY = 'swipe-pwa-notes';
const subs = new Set();

const SEED = [
  { title: '欢迎', body: '这是一个装在主屏幕上的笔记本。\n\n· 右滑返回，返回后左滑前进\n· 断网也能打开、编辑\n· 有未保存的修改时，滑动和返回都会被拦下' },
  { title: '试试离线', body: '打开开发者工具 → Network → Offline，然后刷新。页面照常出现，笔记也都在。' },
  { title: '安装', body: 'Chrome / Edge：首页的“安装”按钮，或地址栏里的安装图标。\niPhone / iPad：Safari 分享按钮 → 添加到主屏幕。' },
].map((n, i) => ({ id: String(i + 1), ...n, updated: Date.now() - i * 3600e3 }));

let notes = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return SEED;
}

function write(next) {
  notes = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  for (const fn of subs) fn();
}

addEventListener('storage', (e) => {
  if (e.key !== KEY) return;
  notes = load();
  for (const fn of subs) fn();
});

const subscribe = (fn) => (subs.add(fn), () => subs.delete(fn));

/** All notes, newest first. */
export function useNotes() {
  return useSyncExternalStore(subscribe, () => notes);
}

export function useNote(id) {
  return useSyncExternalStore(subscribe, () => notes.find((n) => n.id === id) ?? null);
}

/** Create (no id) or update; returns the id. */
export function saveNote({ id, title, body }) {
  const updated = Date.now();
  if (!id) {
    id = updated.toString(36);
    write([{ id, title, body, updated }, ...notes]);
  } else {
    write([{ id, title, body, updated }, ...notes.filter((n) => n.id !== id)]);
  }
  return id;
}

export function deleteNote(id) {
  write(notes.filter((n) => n.id !== id));
}
