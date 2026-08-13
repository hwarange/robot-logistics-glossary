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
  let view = "dict"; // dict | flash | guide
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
      (t.details || "").toLowerCase().includes(q) ||
      (t.example || "").toLowerCase().includes(q) ||
      (t.aiTip || "").toLowerCase().includes(q)
    );
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  }

  // ---------- category nav (sidebar) ----------
  const CAT_ICONS = {
    all: "📚",
    warehouse: "🏭",
    robots: "🤖",
    "robotics-basics": "⚙️",
    simulation: "🧪",
    nvidia: "🟩",
    learning: "🧠",
    frontier: "🚀",
    optimization: "📐",
    "logistics-opt": "📦",
    pathfinding: "🧭",
    multiagent: "🐝",
  };

  function renderCatNav() {
    const nav = $("#catNav");
    nav.innerHTML = "";
    const mk = (id, label, count) => {
      const b = document.createElement("button");
      b.className = "sb-item" + (activeCat === id ? " active" : "");
      b.title = label;
      b.innerHTML =
        `<span class="sb-icon">${CAT_ICONS[id] || "📁"}</span>` +
        `<span class="sb-label">${esc(label)}<span class="count">${count}</span></span>`;
      b.onclick = () => {
        activeCat = id;
        if (view === "guide") setView("dict");
        if (view === "flash") buildDeck();
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

  // ---------- modal ----------
  const overlay = $("#modalOverlay");
  const modalBody = $("#modalBody");

  function sourceLinksHTML(t) {
    if (!t.sources || !t.sources.length) return "";
    const links = t.sources
      .map(
        (s) =>
          `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)} ↗</a>`
      )
      .join("");
    return `<div class="modal-section modal-sources"><h4>📚 출처</h4><div class="sources">${links}</div></div>`;
  }

  function openModal(t) {
    const sec = (icon, title, body, cls) =>
      body
        ? `<div class="modal-section ${cls || ""}"><h4>${icon} ${title}</h4><p>${esc(body)}</p></div>`
        : "";

    modalBody.innerHTML = `
      <span class="cat-badge">${esc(catName(t.category))}</span>
      <h3 id="modalTerm" class="modal-term">${esc(t.term)}</h3>
      <p class="modal-ko">${esc(t.ko)}</p>
      ${sec("📖", "정의", t.definition)}
      ${sec("🔍", "자세히", t.details)}
      ${sec("💡", "예시", t.example, "modal-example")}
      ${sec("🧠", "AI 담당 팁", t.aiTip, "modal-aitip")}
      ${sourceLinksHTML(t)}
    `;

    // know toggle button
    const knowBtn = document.createElement("button");
    knowBtn.className = "btn modal-know" + (known.has(t.id) ? " on" : "");
    knowBtn.textContent = known.has(t.id) ? "✅ 암기 완료" : "☑️ 암기 완료로 표시";
    knowBtn.onclick = () => {
      known.has(t.id) ? known.delete(t.id) : known.add(t.id);
      saveKnown();
      knowBtn.className = "btn modal-know" + (known.has(t.id) ? " on" : "");
      knowBtn.textContent = known.has(t.id) ? "✅ 암기 완료" : "☑️ 암기 완료로 표시";
      if (view === "dict") renderDict();
    };
    modalBody.appendChild(knowBtn);

    // related terms
    if (t.related && t.related.length) {
      const wrap = document.createElement("div");
      wrap.className = "modal-section";
      wrap.innerHTML = "<h4>🔗 관련 용어</h4>";
      const tags = document.createElement("div");
      tags.className = "related-tags";
      t.related.forEach((name) => {
        const target = findByName(name);
        const tag = document.createElement("button");
        tag.className = "rel-tag" + (target ? " linked" : "");
        tag.textContent = "# " + name;
        tag.onclick = () => {
          if (target) openModal(target);
          else {
            closeModal();
            $("#searchInput").value = name;
            query = name;
            activeCat = "all";
            setView("dict");
            renderCatNav();
            render();
          }
        };
        tags.appendChild(tag);
      });
      wrap.appendChild(tags);
      modalBody.appendChild(wrap);
    }

    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    $(".modal").scrollTop = 0;
  }

  function closeModal() {
    overlay.hidden = true;
    document.body.style.overflow = "";
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  $("#modalClose").addEventListener("click", closeModal);

  // ---------- dictionary view ----------
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
      card.className = "term-card clickable" + (known.has(t.id) ? " known" : "");
      card.id = "term-" + t.id;
      card.tabIndex = 0;

      const top = document.createElement("div");
      top.className = "card-top";
      top.innerHTML = `<div><div class="term-name">${esc(t.term)}</div><div class="term-ko">${esc(t.ko)}</div></div>`;

      const knowBtn = document.createElement("button");
      knowBtn.className = "know-toggle" + (known.has(t.id) ? " on" : "");
      knowBtn.textContent = known.has(t.id) ? "✅" : "☑️";
      knowBtn.title = "암기 완료 표시";
      knowBtn.onclick = (e) => {
        e.stopPropagation();
        known.has(t.id) ? known.delete(t.id) : known.add(t.id);
        saveKnown();
        renderDict();
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

      const more = document.createElement("span");
      more.className = "card-more";
      more.textContent = "클릭해서 예시 · AI 팁 보기 →";
      card.appendChild(more);

      const open = () => openModal(t);
      card.addEventListener("click", open);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter") open();
      });

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
      `학습 모드 · ${activeCat === "all" ? "전체" : catName(activeCat)} · 암기 완료 ${known.size}/${terms.length}`;

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
    back.innerHTML =
      `<div class="fc-ko">${esc(t.ko)}</div>` +
      `<p class="fc-def">${esc(t.definition)}</p>` +
      (t.example ? `<p class="fc-example">💡 ${esc(t.example)}</p>` : "") +
      (t.details ? `<p class="fc-details">${esc(t.details)}</p>` : "");

    front.hidden = flipped;
    back.hidden = !flipped;

    card.onclick = () => {
      flipped = !flipped;
      renderFlash();
    };
  }

  function nextFlash(markKnown) {
    if (flashIdx < flashDeck.length) {
      const t = flashDeck[flashIdx];
      if (markKnown) known.add(t.id);
      else known.delete(t.id);
      saveKnown();
    }
    flashIdx++;
    flipped = false;
    renderFlash();
  }

  // ---------- view switching ----------
  function setView(v) {
    view = v;
    $("#dictView").hidden = v !== "dict";
    $("#flashView").hidden = v !== "flash";
    $("#guideView").hidden = v !== "guide";

    const modeBtn = $("#modeToggle");
    modeBtn.classList.toggle("active", v === "flash");
    modeBtn.textContent = v === "flash" ? "📖 사전 모드" : "🎴 학습 모드";
    const guideBtn = $("#guideToggle");
    guideBtn.classList.toggle("active", v === "guide");

    if (v === "flash") buildDeck();
    if (v === "guide")
      $("#statsBar").textContent = "AI 담당 학습 가이드";
    render();
  }

  function render() {
    if (view === "dict") renderDict();
    else if (view === "flash") renderFlash();
  }

  // ---------- events ----------
  $("#searchInput").addEventListener("input", (e) => {
    query = e.target.value.trim();
    if (view !== "dict") setView("dict");
    render();
  });

  $("#searchIconBtn").addEventListener("click", () => $("#searchInput").focus());

  $("#hideKnown").addEventListener("change", (e) => {
    hideKnown = e.target.checked;
    render();
  });

  $("#modeToggle").addEventListener("click", () =>
    setView(view === "flash" ? "dict" : "flash")
  );
  $("#guideToggle").addEventListener("click", () =>
    setView(view === "guide" ? "dict" : "guide")
  );
  $("#btnKnow").addEventListener("click", () => nextFlash(true));
  $("#btnDontKnow").addEventListener("click", () => nextFlash(false));
  $("#btnShuffle").addEventListener("click", () => {
    buildDeck();
    renderFlash();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) {
      closeModal();
      return;
    }
    if (view !== "flash" || e.target.tagName === "INPUT") return;
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
  setView("dict");
})();
