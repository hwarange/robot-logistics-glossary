/* 물류 로봇 시뮬레이션 용어사전 */
(function () {
  "use strict";

  const DATA = window.GLOSSARY_DATA || { categories: [], terms: [] };
  const terms = DATA.terms;
  const categories = DATA.categories;

  // ---------- state ----------
  let activeCat = "all";
  let query = "";
  let hideKnown = false;
  let flashMode = false;
  let flashDeck = [];
  let flashIdx = 0;
  let flipped = false;

  const known = new Set(JSON.parse(localStorage.getItem("glossary-known") || "[]"));
  const saveKnown = () =>
    localStorage.setItem("glossary-known", JSON.stringify([...known]));

  // ---------- helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const catName = (id) => {
    const c = categories.find((c) => c.id === id);
    return c ? c.ko : id;
  };

  const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, "");

  // index for related-tag lookup: english term name → term object
  const nameIndex = new Map();
  terms.forEach((t) => {
    nameIndex.set(norm(t.term), t);
    // also index the bare acronym / name without parenthetical
    const bare = t.term.replace(/\s*\(.*?\)\s*/g, "");
    nameIndex.set(norm(bare), t);
    const paren = (t.term.match(/\((.*?)\)/) || [])[1];
    if (paren) nameIndex.set(norm(paren), t);
  });

  function findByName(name) {
    return nameIndex.get(norm(name)) || null;
  }

  function matches(t) {
    if (activeCat !== "all" && t.category !== activeCat) return false;
    if (hideKnown && known.has(t.id)) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      t.term.toLowerCase().includes(q) ||
      (t.ko || "").toLowerCase().includes(q) ||
      (t.definition || "").toLowerCase().includes(q) ||
      (t.details || "").toLowerCase().includes(q)
    );
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  }

  // ---------- category nav ----------
  function renderCatNav() {
    const nav = $("#catNav");
    nav.innerHTML = "";
    const mk = (id, label, count) => {
      const b = document.createElement("button");
      b.className = "cat-chip" + (activeCat === id ? " active" : "");
      b.innerHTML = `${esc(label)}<span class="count">${count}</span>`;
      b.onclick = () => {
        activeCat = id;
        renderCatNav();
        render();
      };
      return b;
    };
    nav.appendChild(mk("all", "전체", terms.length));
    categories.forEach((c) => {
      const count = terms.filter((t) => t.category === c.id).length;
      nav.appendChild(mk(c.id, c.ko, count));
    });
  }

  // ---------- dictionary view ----------
  function sourceLinks(t) {
    if (!t.sources || !t.sources.length) return "";
    const links = t.sources
      .map(
        (s) =>
          `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)} ↗</a>`
      )
      .join("");
    return `<div class="sources"><span class="src-label">출처</span>${links}</div>`;
  }

  function relatedTags(t) {
    if (!t.related || !t.related.length) return null;
    const wrap = document.createElement("div");
    wrap.className = "related-tags";
    t.related.forEach((name) => {
      const target = findByName(name);
      const tag = document.createElement("button");
      tag.className = "rel-tag";
      tag.textContent = "# " + name;
      if (target) {
        tag.title = target.ko || target.term;
        tag.onclick = () => jumpToTerm(target);
      } else {
        tag.onclick = () => {
          $("#searchInput").value = name;
          query = name;
          activeCat = "all";
          renderCatNav();
          render();
        };
      }
      wrap.appendChild(tag);
    });
    return wrap;
  }

  function jumpToTerm(target) {
    activeCat = "all";
    query = "";
    $("#searchInput").value = "";
    renderCatNav();
    render();
    requestAnimationFrame(() => {
      const el = document.getElementById("term-" + target.id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("highlight");
      const btn = el.querySelector(".details-toggle");
      const det = el.querySelector(".term-details");
      if (det && det.hidden && btn) btn.click();
      setTimeout(() => el.classList.remove("highlight"), 2200);
    });
  }

  function renderDict() {
    const grid = $("#dictView");
    grid.innerHTML = "";
    const list = terms.filter(matches);

    $("#statsBar").textContent =
      `${list.length}개 표시 중 · 전체 ${terms.length}개 · 암기 완료 ${known.size}개`;

    if (!list.length) {
      grid.innerHTML = `<p class="empty-msg">검색 결과가 없습니다 🤔</p>`;
      return;
    }

    const frag = document.createDocumentFragment();
    list.forEach((t) => {
      const card = document.createElement("article");
      card.className = "term-card" + (known.has(t.id) ? " known" : "");
      card.id = "term-" + t.id;

      const top = document.createElement("div");
      top.className = "card-top";
      top.innerHTML = `<div><div class="term-name">${esc(t.term)}</div><div class="term-ko">${esc(t.ko)}</div></div>`;

      const knowBtn = document.createElement("button");
      knowBtn.className = "know-toggle" + (known.has(t.id) ? " on" : "");
      knowBtn.textContent = known.has(t.id) ? "✅" : "☑️";
      knowBtn.title = "암기 완료 표시";
      knowBtn.onclick = () => {
        known.has(t.id) ? known.delete(t.id) : known.add(t.id);
        saveKnown();
        render();
      };
      top.appendChild(knowBtn);
      card.appendChild(top);

      const badge = document.createElement("span");
      badge.className = "cat-badge";
      badge.textContent = catName(t.category);
      card.appendChild(badge);

      const def = document.createElement("p");
      def.className = "term-def";
      def.textContent = t.definition;
      card.appendChild(def);

      if (t.details || (t.sources && t.sources.length)) {
        const toggle = document.createElement("button");
        toggle.className = "details-toggle";
        toggle.textContent = "자세히 보기 ▾";
        const details = document.createElement("div");
        details.className = "term-details";
        details.hidden = true;
        details.innerHTML = `${t.details ? `<p>${esc(t.details)}</p>` : ""}${sourceLinks(t)}`;
        toggle.onclick = () => {
          details.hidden = !details.hidden;
          toggle.textContent = details.hidden ? "자세히 보기 ▾" : "접기 ▴";
        };
        card.appendChild(toggle);
        card.appendChild(details);
      }

      const rel = relatedTags(t);
      if (rel) card.appendChild(rel);

      frag.appendChild(card);
    });
    grid.appendChild(frag);
  }

  // ---------- flashcards ----------
  function buildDeck() {
    let pool = terms.filter(
      (t) => (activeCat === "all" || t.category === activeCat) && !known.has(t.id)
    );
    if (!pool.length)
      pool = terms.filter((t) => activeCat === "all" || t.category === activeCat);
    // shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    flashDeck = pool;
    flashIdx = 0;
    flipped = false;
  }

  function renderFlash() {
    const front = $("#flashFront");
    const back = $("#flashBack");
    const bar = $("#flashProgressBar");
    const counter = $("#flashCounter");
    const card = $("#flashcard");

    $("#statsBar").textContent =
      `학습 모드 · ${catName2(activeCat)} · 암기 완료 ${known.size}/${terms.length}`;

    if (!flashDeck.length || flashIdx >= flashDeck.length) {
      bar.style.width = "100%";
      counter.textContent = "";
      front.hidden = false;
      back.hidden = true;
      front.innerHTML = `<div class="flash-done"><h2>🎉 한 바퀴 완료!</h2><p>이 범위의 카드를 모두 봤어요. 다시 섞어서 복습할 수 있습니다.</p></div>`;
      card.onclick = null;
      return;
    }

    const t = flashDeck[flashIdx];
    bar.style.width = `${(flashIdx / flashDeck.length) * 100}%`;
    counter.textContent = `${flashIdx + 1} / ${flashDeck.length}`;

    front.innerHTML = `<div class="fc-term">${esc(t.term)}</div><div class="fc-cat"><span class="cat-badge">${esc(catName(t.category))}</span></div>`;
    back.innerHTML = `<div class="fc-ko">${esc(t.ko)}</div><p class="fc-def">${esc(t.definition)}</p>${t.details ? `<p class="fc-details">${esc(t.details)}</p>` : ""}`;

    front.hidden = flipped;
    back.hidden = !flipped;

    card.onclick = () => {
      flipped = !flipped;
      renderFlash();
    };
  }

  function catName2(id) {
    return id === "all" ? "전체" : catName(id);
  }

  function nextFlash(markKnown) {
    if (flashIdx < flashDeck.length) {
      const t = flashDeck[flashIdx];
      if (markKnown) {
        known.add(t.id);
        saveKnown();
      } else {
        known.delete(t.id);
        saveKnown();
      }
    }
    flashIdx++;
    flipped = false;
    renderFlash();
  }

  // ---------- render root ----------
  function render() {
    $("#dictView").hidden = flashMode;
    $("#flashView").hidden = !flashMode;
    if (flashMode) renderFlash();
    else renderDict();
  }

  // ---------- events ----------
  $("#searchInput").addEventListener("input", (e) => {
    query = e.target.value.trim();
    if (flashMode) toggleMode(false);
    render();
  });

  $("#hideKnown").addEventListener("change", (e) => {
    hideKnown = e.target.checked;
    render();
  });

  function toggleMode(on) {
    flashMode = on;
    const btn = $("#modeToggle");
    btn.classList.toggle("active", flashMode);
    btn.textContent = flashMode ? "📖 사전 모드" : "🎴 학습 모드";
    if (flashMode) buildDeck();
    render();
  }

  $("#modeToggle").addEventListener("click", () => toggleMode(!flashMode));
  $("#btnKnow").addEventListener("click", () => nextFlash(true));
  $("#btnDontKnow").addEventListener("click", () => nextFlash(false));
  $("#btnShuffle").addEventListener("click", () => {
    buildDeck();
    renderFlash();
  });

  // keyboard shortcuts in flash mode
  document.addEventListener("keydown", (e) => {
    if (!flashMode || e.target.tagName === "INPUT") return;
    if (e.code === "Space") {
      e.preventDefault();
      flipped = !flipped;
      renderFlash();
    } else if (e.key === "ArrowRight") nextFlash(true);
    else if (e.key === "ArrowLeft") nextFlash(false);
  });

  // ---------- theme ----------
  const themeBtn = $("#themeToggle");
  function applyTheme(mode) {
    document.documentElement.setAttribute("data-theme", mode);
    themeBtn.textContent = mode === "dark" ? "☀️" : "🌙";
    localStorage.setItem("glossary-theme", mode);
  }
  const savedTheme =
    localStorage.getItem("glossary-theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(savedTheme);
  themeBtn.addEventListener("click", () =>
    applyTheme(
      document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"
    )
  );

  // ---------- init ----------
  renderCatNav();
  render();
})();
