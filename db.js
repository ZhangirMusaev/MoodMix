// «Бэкенд» в браузере: все данные хранятся в localStorage. Используется обеими страницами.
const DB = {
  K: "astana_db", S: "astana_session",
  load() { try { return JSON.parse(localStorage.getItem(this.K)) || { users: {} }; } catch { return { users: {} }; } },
  store(d) { localStorage.setItem(this.K, JSON.stringify(d)); },
  pub(u) { return { login: u.login, created: u.created, favs: u.favs, visits: u.visits, moods: u.moods, last: u.moods[u.moods.length - 1] || null }; },
  cyrb(s) { let a = 0xdeadbeef, b = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); }
    a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909); b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
    return (4294967296 * (2097151 & b) + (a >>> 0)).toString(16); },
  async hash(pw, salt, alg) {
    const s = salt + pw, sub = globalThis.crypto && crypto.subtle;
    alg = alg || (sub ? "s:" : "c:");
    if (alg === "s:" && sub) { const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return "s:" + [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, "0")).join(""); }
    return "c:" + this.cyrb(s);
  },
  async call(p, b = {}) {
    const d = this.load();
    if (p === "register") {
      const { login, password } = b;
      if (typeof login !== "string" || !/^[\p{L}\p{N}_.-]{3,32}$/u.test(login)) throw new Error("Логин: 3–32 символа (буквы, цифры, _ . -)");
      if (typeof password !== "string" || password.length < 6 || password.length > 100) throw new Error("Пароль: от 6 символов");
      const k = login.toLowerCase();
      if (d.users[k]) throw new Error("Такой логин уже занят");
      const salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
      d.users[k] = { login, salt, hash: await this.hash(password, salt), created: new Date().toISOString(), favs: [], visits: [], moods: [] };
      this.store(d); localStorage.setItem(this.S, k); return this.pub(d.users[k]);
    }
    if (p === "login") {
      const u = d.users[String(b.login || "").toLowerCase()];
      if (!u || u.hash !== await this.hash(String(b.password || ""), u.salt, u.hash.slice(0, 2))) throw new Error("Неверный логин или пароль");
      localStorage.setItem(this.S, u.login.toLowerCase()); return this.pub(u);
    }
    if (p === "logout") { localStorage.removeItem(this.S); return { ok: true }; }
    const k = localStorage.getItem(this.S), u = k && d.users[k];
    if (!u) throw new Error("Требуется вход");
    const ok = (v, n) => typeof v === "string" && v.length > 0 && v.length <= n;
    if (p === "mood") {
      const { mood, energy, cats } = b;
      if (!ok(mood, 100) || !Number.isFinite(energy) || !Array.isArray(cats) || cats.length !== 2) throw new Error("Некорректные данные теста");
      u.moods = [...u.moods, { mood, energy, cats, at: new Date().toISOString() }].slice(-100);
    } else if (p === "visit") {
      if (!ok(b.place, 100) || !ok(b.cat, 50)) throw new Error("Некорректные данные");
      u.visits = [...u.visits, { place: b.place, cat: b.cat, at: new Date().toISOString() }].slice(-500);
    } else if (p === "fav") {
      if (!ok(b.key, 150)) throw new Error("Некорректные данные");
      u.favs = u.favs.includes(b.key) ? u.favs.filter(x => x !== b.key) : [...u.favs, b.key];
    } else if (p !== "me") throw new Error("Неизвестная операция");
    this.store(d); return this.pub(u);
  },
};