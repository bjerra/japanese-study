(function () {
  var LEVELS = [
    { id: "N5", label: "N5" },
    { id: "N4", label: "N4" },
    { id: "N3", label: "N3" },
    { id: "N2", label: "N2" },
    { id: "N1", label: "N1" },
    { id: "none", label: "No JLPT level" }
  ];

  var cardSearch = new WeakMap();
  var cardWords = new WeakMap();
  var sectionWords = new WeakMap();
  var allWords = [];
  var levelWords = {};
  var level = "all";

  document.addEventListener("DOMContentLoaded", function () {
    var status = document.getElementById("kanji-status");
    var tools = document.getElementById("kanji-tools");
    var list = document.getElementById("kanji-list");
    if (!status || !list) return;

    Promise.all([fetchJson("lessons/index.json"), fetchJson("data/jlpt-kanji.json")])
      .then(function (loaded) {
        var ids = lessonIds(loaded[0]);
        var table = loaded[1] && loaded[1].kanji ? loaded[1].kanji : {};
        return Promise.all(ids.map(function (id) {
          return fetchJson("lessons/" + id + ".json");
        })).then(function (lessons) {
          return { lessons: lessons, table: table };
        });
      })
      .then(function (loaded) {
        var built = buildIndex(loaded.lessons, loaded.table);
        allWords = built.words;
        levelWords = built.levelWords;
        render(list, built.groups);
        status.hidden = true;
        if (tools) tools.hidden = false;
        wireControls();
        applyFilter();
        refreshScores();
      })
      .catch(function (error) {
        var hint = location.protocol === "file:"
          ? " Open the site through a local web server, not as a file."
          : "";
        status.hidden = false;
        status.classList.add("error");
        status.textContent = error.message + hint;
      });

    window.addEventListener("japanese-study-vocab-scores", refreshScores);
  });

  function fetchJson(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error("Could not load " + url + " (" + response.status + ").");
      return response.text();
    }).then(function (text) {
      return JSON.parse(text.replace(/^\uFEFF/, ""));
    });
  }

  function lessonIds(index) {
    var ids = [];
    var lessons = index && Array.isArray(index.lessons) ? index.lessons : [];
    var stories = index && Array.isArray(index.stories) ? index.stories : [];
    lessons.forEach(add);
    stories.forEach(function (story) {
      var parts = story && Array.isArray(story.parts) ? story.parts : [];
      parts.forEach(add);
    });
    function add(id) {
      if (typeof id === "string" && id && ids.indexOf(id) === -1) ids.push(id);
    }
    return ids;
  }

  function isKanji(ch) {
    var code = ch.codePointAt(0);
    return (
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0x20000 && code <= 0x3ffff)
    );
  }

  function kanjiChars(text) {
    var found = [];
    var seen = Object.create(null);
    Array.from(String(text || "")).forEach(function (ch) {
      if (!isKanji(ch) || seen[ch]) return;
      seen[ch] = true;
      found.push(ch);
    });
    return found;
  }

  function fold(value) {
    return String(value || "").toLowerCase().replace(/[\u30a1-\u30f6]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0x60);
    });
  }

  function buildIndex(lessons, table) {
    var wordMap = Object.create(null);
    var kanjiMap = Object.create(null);
    var rank = Object.create(null);
    Object.keys(table || {}).forEach(function (ch, index) {
      rank[ch] = index;
    });

    lessons.forEach(function (lesson) {
      if (!lesson || typeof lesson !== "object") return;
      var vocab = Array.isArray(lesson.vocabulary) ? lesson.vocabulary : [];
      vocab.forEach(function (item) {
        if (!item || typeof item.word !== "string" || typeof item.reading !== "string") return;
        var word = item.word.replace(/^\s+|\s+$/g, "");
        var reading = item.reading.replace(/^\s+|\s+$/g, "");
        var meaning = typeof item.meaning === "string" ? item.meaning.replace(/^\s+|\s+$/g, "") : "";
        if (!word || !reading) return;
        var chars = kanjiChars(word);
        if (!chars.length) return;
        var key = word + "\n" + reading;
        if (!wordMap[key]) {
          wordMap[key] = { word: word, reading: reading, meaning: meaning, lessons: [] };
        } else if (meaning && wordMap[key].meaning.indexOf(meaning) === -1) {
          wordMap[key].meaning = wordMap[key].meaning ? wordMap[key].meaning + "; " + meaning : meaning;
        }
        var links = wordMap[key].lessons;
        if (!links.some(function (link) { return link.id === lesson.id; })) {
          links.push({ id: lesson.id, title: lesson.title || lesson.id });
        }
        chars.forEach(function (ch) {
          if (!kanjiMap[ch]) kanjiMap[ch] = [];
          if (kanjiMap[ch].indexOf(key) === -1) kanjiMap[ch].push(key);
        });
      });
    });

    var groups = {};
    LEVELS.forEach(function (item) { groups[item.id] = []; });
    Object.keys(kanjiMap).forEach(function (ch) {
      var entry = table && table[ch];
      var levelId = entry && typeof entry[0] === "string" ? entry[0] : "none";
      if (!groups[levelId]) levelId = "none";
      var words = kanjiMap[ch].map(function (key) { return wordMap[key]; });
      words.sort(function (a, b) {
        return a.reading.localeCompare(b.reading, "ja") || a.word.localeCompare(b.word, "ja");
      });
      groups[levelId].push({
        char: ch,
        levelId: levelId,
        meanings: entry && entry[1] ? entry[1] : "",
        on: entry && entry[2] ? entry[2] : "",
        kun: entry && entry[3] ? entry[3] : "",
        words: words
      });
    });
    LEVELS.forEach(function (item) {
      groups[item.id].sort(function (a, b) {
        var ar = Object.prototype.hasOwnProperty.call(rank, a.char) ? rank[a.char] : 1000000 + a.char.codePointAt(0);
        var br = Object.prototype.hasOwnProperty.call(rank, b.char) ? rank[b.char] : 1000000 + b.char.codePointAt(0);
        return ar - br;
      });
    });

    var words = Object.keys(wordMap).map(function (key) { return wordMap[key]; });
    var byLevel = {};
    LEVELS.forEach(function (item) {
      var seen = Object.create(null);
      byLevel[item.id] = [];
      groups[item.id].forEach(function (kanji) {
        kanji.words.forEach(function (word) {
          var key = word.word + "\n" + word.reading;
          if (seen[key]) return;
          seen[key] = true;
          byLevel[item.id].push(word);
        });
      });
    });
    return { groups: groups, words: words, levelWords: byLevel };
  }

  function render(list, groups) {
    list.replaceChildren();
    LEVELS.forEach(function (item) {
      var kanji = groups[item.id];
      var chip = document.querySelector('.level-chip[data-level="' + item.id + '"] .chip-count');
      if (chip) chip.textContent = String(kanji.length);
      if (!kanji.length) return;
      var section = document.createElement("section");
      section.className = "kanji-level";
      section.id = "level-" + item.id;
      section.dataset.level = item.id;

      var head = document.createElement("div");
      head.className = "kanji-level-head";
      var title = document.createElement("h2");
      title.textContent = item.label;
      var meta = document.createElement("p");
      meta.className = "kanji-level-meta";
      var count = document.createElement("span");
      count.className = "kanji-level-count";
      count.textContent = kanji.length + " kanji";
      meta.append(count);
      var levelScore = scoreText();
      levelScore.classList.add("kanji-level-score");
      head.append(title, meta, meter(), levelScore);
      section.append(head);

      var grid = document.createElement("div");
      grid.className = "kanji-grid";
      var words = [];
      var seen = Object.create(null);
      kanji.forEach(function (entry) {
        grid.append(kanjiCard(entry));
        entry.words.forEach(function (word) {
          var key = word.word + "\n" + word.reading;
          if (seen[key]) return;
          seen[key] = true;
          words.push(word);
        });
      });
      section.append(grid);
      sectionWords.set(section, words);
      list.append(section);
    });
    var allChip = document.querySelector('.level-chip[data-level="all"] .chip-count');
    if (allChip) allChip.textContent = String(list.querySelectorAll(".kanji-card").length);
  }

  function scoreText() {
    var node = document.createElement("span");
    node.className = "kanji-score-text";
    node.textContent = "0/0 mastered";
    return node;
  }

  function meter() {
    var node = document.createElement("div");
    node.className = "kanji-meter";
    node.setAttribute("role", "meter");
    node.setAttribute("aria-valuemin", "0");
    node.setAttribute("aria-valuemax", "0");
    node.setAttribute("aria-valuenow", "0");
    var fill = document.createElement("span");
    fill.className = "kanji-meter-fill";
    node.append(fill);
    return node;
  }

  var detailSeq = 0;

  function kanjiCard(entry) {
    var card = document.createElement("article");
    card.className = "kanji-card";
    card.dataset.kanji = entry.char;
    detailSeq += 1;
    var detailId = "kanji-detail-" + detailSeq;

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "kanji-toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", detailId);
    var glyph = document.createElement("span");
    glyph.className = "kanji-char";
    glyph.lang = "ja";
    glyph.setAttribute("translate", "no");
    glyph.textContent = entry.char;
    var tileMeter = meter();
    tileMeter.setAttribute("aria-hidden", "true");
    var tileScore = scoreText();
    tileScore.textContent = "0/" + entry.words.length;
    toggle.append(glyph, tileMeter, tileScore);
    toggle.addEventListener("click", function () {
      setExpanded(card, !card.classList.contains("is-open"));
      syncExpandAll();
    });

    var detail = document.createElement("div");
    detail.className = "kanji-detail";
    detail.id = detailId;
    detail.hidden = true;

    var tag = document.createElement("p");
    tag.className = "kanji-tag";
    tag.textContent = entry.levelId === "none" ? "No JLPT level" : entry.levelId;
    detail.append(tag);
    if (entry.meanings) {
      var gloss = document.createElement("p");
      gloss.className = "kanji-gloss";
      gloss.textContent = entry.meanings;
      detail.append(gloss);
    }
    var reading = [entry.on, entry.kun].filter(Boolean).join(" · ");
    if (reading) {
      var read = document.createElement("p");
      read.className = "kanji-reading";
      read.lang = "ja";
      read.setAttribute("translate", "no");
      read.textContent = reading;
      detail.append(read);
    }
    var practice = document.createElement("button");
    practice.type = "button";
    practice.className = "kanji-practice";
    practice.textContent = "Practice";
    practice.addEventListener("click", function () {
      startPractice(entry.words, entry.char);
    });
    detail.append(practice);
    var words = document.createElement("ul");
    words.className = "kanji-words";
    entry.words.forEach(function (word) {
      words.append(wordItem(word));
    });
    detail.append(words);
    card.append(toggle, detail);

    cardWords.set(card, entry.words);
    cardSearch.set(card, fold([
      entry.char,
      entry.meanings,
      entry.on,
      entry.kun,
      entry.words.map(function (word) {
        return word.word + " " + word.reading + " " + word.meaning;
      }).join(" ")
    ].join(" ")));
    paintToggle(card, 0, entry.words.length);
    return card;
  }

  function setExpanded(card, open) {
    var toggle = card.querySelector(".kanji-toggle");
    var detail = card.querySelector(".kanji-detail");
    card.classList.toggle("is-open", !!open);
    if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (detail) detail.hidden = !open;
    var words = cardWords.get(card) || [];
    paintToggle(card, countMastered(words), words.length);
  }

  function paintToggle(card, got, total) {
    var toggle = card.querySelector(".kanji-toggle");
    if (!toggle) return;
    var open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-label", card.dataset.kanji + ", " + got + " of " + total + " words mastered. " + (open ? "Hide details." : "Show details."));
  }

  function visibleExpanded() {
    var cards = visibleCards();
    return cards.length > 0 && cards.every(function (card) {
      return card.classList.contains("is-open");
    });
  }

  function syncExpandAll() {
    var button = document.getElementById("kanji-expand");
    if (!button) return;
    var allOpen = visibleExpanded();
    button.textContent = allOpen ? "Collapse all" : "Expand all";
    button.setAttribute("aria-pressed", allOpen ? "true" : "false");
  }

  function wordItem(word) {
    var item = document.createElement("li");
    item.className = "kanji-word-item";
    item.dataset.word = word.word;
    item.dataset.reading = word.reading;

    var mark = document.createElement("span");
    mark.className = "kanji-word-mark";
    mark.setAttribute("aria-hidden", "true");
    var label = document.createElement("span");
    label.className = "kanji-word";
    label.lang = "ja";
    label.setAttribute("translate", "no");
    label.textContent = word.word;
    var reading = document.createElement("span");
    reading.className = "kanji-word-reading";
    reading.lang = "ja";
    reading.setAttribute("translate", "no");
    reading.textContent = word.reading;
    var meaning = document.createElement("span");
    meaning.className = "kanji-word-meaning";
    meaning.textContent = word.meaning;
    item.append(mark, label, reading, meaning);

    if (word.lessons.length) {
      var links = document.createElement("span");
      links.className = "kanji-lessons";
      word.lessons.forEach(function (lesson, index) {
        if (index) links.append(document.createTextNode(" · "));
        var anchor = document.createElement("a");
        anchor.href = "lesson.html?id=" + encodeURIComponent(lesson.id) + "#vocab";
        anchor.textContent = lesson.title;
        anchor.lang = "ja";
        anchor.setAttribute("translate", "no");
        links.append(anchor);
      });
      item.append(links);
    }
    return item;
  }

  function wireControls() {
    var search = document.getElementById("kanji-search");
    if (search) search.addEventListener("input", applyFilter);
    document.querySelectorAll(".level-chip").forEach(function (button) {
      button.addEventListener("click", function () {
        level = button.dataset.level || "all";
        document.querySelectorAll(".level-chip").forEach(function (chip) {
          chip.setAttribute("aria-pressed", chip === button ? "true" : "false");
        });
        applyFilter();
      });
    });
    var select = document.getElementById("practice-set");
    if (select) select.addEventListener("change", updatePracticeControl);
    var start = document.getElementById("practice-start");
    if (start) {
      start.addEventListener("click", function () {
        var value = select ? select.value : "all";
        var words = wordsFor(value);
        var label = select ? select.options[select.selectedIndex].getAttribute("data-label") || value : value;
        startPractice(words, label);
      });
    }
    var reset = document.getElementById("score-reset");
    if (reset) {
      reset.addEventListener("click", function () {
        if (!window.JapaneseStudyScores) return;
        if (!window.confirm("Reset all vocabulary practice scores on this browser?")) return;
        JapaneseStudyScores.reset();
      });
    }
    var expand = document.getElementById("kanji-expand");
    if (expand) {
      expand.addEventListener("click", function () {
        var open = !visibleExpanded();
        visibleCards().forEach(function (card) {
          setExpanded(card, open);
        });
        syncExpandAll();
      });
    }
    var list = document.getElementById("kanji-list");
    if (list) list.addEventListener("keydown", onGridKey);
  }

  function wordsFor(value) {
    if (value === "filtered") return uniqueWords(visibleCards());
    if (value === "all") return allWords;
    return levelWords[value] || [];
  }

  function visibleCards() {
    return Array.prototype.filter.call(document.querySelectorAll(".kanji-card"), function (card) {
      return !card.hidden;
    });
  }

  function uniqueWords(cards) {
    var seen = Object.create(null);
    var words = [];
    cards.forEach(function (card) {
      (cardWords.get(card) || []).forEach(function (word) {
        var key = word.word + "\n" + word.reading;
        if (seen[key]) return;
        seen[key] = true;
        words.push(word);
      });
    });
    return words;
  }

  function matches(card, query) {
    if (!query) return true;
    var blob = cardSearch.get(card) || "";
    return blob.indexOf(query) !== -1;
  }

  function applyFilter() {
    var search = document.getElementById("kanji-search");
    var query = fold(search ? search.value : "");
    var shown = 0;
    document.querySelectorAll(".kanji-level").forEach(function (section) {
      var visible = 0;
      var total = 0;
      section.querySelectorAll(".kanji-card").forEach(function (card) {
        total += 1;
        var on = (level === "all" || section.dataset.level === level) && matches(card, query);
        card.hidden = !on;
        if (on) visible += 1;
      });
      section.hidden = visible === 0;
      var count = section.querySelector(".kanji-level-count");
      if (count) count.textContent = visible === total ? total + " kanji" : visible + " of " + total + " kanji";
      shown += visible;
    });
    var empty = document.getElementById("kanji-empty");
    if (empty) empty.hidden = shown !== 0;
    updatePracticeControl();
    updateSummary();
    syncExpandAll();
  }

  function updatePracticeControl() {
    var select = document.getElementById("practice-set");
    var start = document.getElementById("practice-start");
    if (!select || !window.JapaneseStudyGame) return;
    Array.prototype.forEach.call(select.options, function (option) {
      var label = option.getAttribute("data-label") || option.textContent;
      var count = wordsFor(option.value).length;
      option.textContent = label + " (" + count + ")";
    });
    var playable = JapaneseStudyGame.playableWords(wordsFor(select.value));
    if (start) {
      start.disabled = playable.length === 0;
      start.textContent = playable.length ? "Start · " + playable.length : "Start";
    }
  }

  function countMastered(words) {
    var n = 0;
    words.forEach(function (word) {
      if (window.JapaneseStudyScores && JapaneseStudyScores.isMastered(word.word, word.reading)) n += 1;
    });
    return n;
  }

  function setMeter(node, got, total) {
    if (!node) return;
    var pct = total ? Math.round((got / total) * 100) : 0;
    node.setAttribute("aria-valuemax", String(total));
    node.setAttribute("aria-valuenow", String(got));
    node.setAttribute("aria-label", got + " of " + total + " words mastered");
    node.classList.toggle("is-complete", total > 0 && got === total);
    var fill = node.querySelector(".kanji-meter-fill");
    if (fill) fill.style.width = pct + "%";
  }

  function refreshScores() {
    document.querySelectorAll(".kanji-card").forEach(function (card) {
      var words = cardWords.get(card) || [];
      var got = countMastered(words);
      setMeter(card.querySelector(".kanji-meter"), got, words.length);
      var text = card.querySelector(".kanji-toggle .kanji-score-text");
      if (text) text.textContent = got + "/" + words.length;
      paintToggle(card, got, words.length);
      card.querySelectorAll(".kanji-word-item").forEach(function (item) {
        var on = window.JapaneseStudyScores && JapaneseStudyScores.isMastered(item.dataset.word, item.dataset.reading);
        item.classList.toggle("is-mastered", !!on);
        var row = window.JapaneseStudyScores && JapaneseStudyScores.stats(item.dataset.word, item.dataset.reading);
        item.title = row ? row.firstTry + " first-try correct of " + row.attempts + " attempts" : "";
      });
    });
    document.querySelectorAll(".kanji-level").forEach(function (section) {
      var words = sectionWords.get(section) || [];
      var got = countMastered(words);
      setMeter(section.querySelector(".kanji-level-head .kanji-meter"), got, words.length);
      var text = section.querySelector(".kanji-level-score");
      if (text) text.textContent = got + "/" + words.length + " mastered";
    });
    updateSummary();
  }

  function onGridKey(event) {
    if (event.key === "Escape") {
      var card = event.target.closest && event.target.closest(".kanji-card");
      if (!card || !card.classList.contains("is-open")) return;
      event.preventDefault();
      setExpanded(card, false);
      syncExpandAll();
      var toggle = card.querySelector(".kanji-toggle");
      if (toggle) toggle.focus();
      return;
    }
    var arrows = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
    if (arrows.indexOf(event.key) === -1) return;
    var current = event.target.closest && event.target.closest(".kanji-toggle");
    if (!current) return;
    var buttons = visibleCards().map(function (item) {
      return item.querySelector(".kanji-toggle");
    }).filter(Boolean);
    var index = buttons.indexOf(current);
    if (index < 0) return;
    var columns = gridColumns(current);
    var next = index;
    if (event.key === "ArrowRight") next = index + 1;
    else if (event.key === "ArrowLeft") next = index - 1;
    else if (event.key === "ArrowDown") next = index + columns;
    else if (event.key === "ArrowUp") next = index - columns;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = buttons.length - 1;
    if (next < 0 || next >= buttons.length || next === index) return;
    event.preventDefault();
    buttons[next].focus();
  }

  function gridColumns(button) {
    var grid = button.closest(".kanji-grid");
    if (!grid) return 1;
    var template = window.getComputedStyle(grid).gridTemplateColumns;
    if (!template || template === "none") return 1;
    var count = template.split(" ").filter(Boolean).length;
    return count || 1;
  }

  function updateSummary() {
    var summary = document.getElementById("kanji-summary");
    if (!summary || !document.querySelector(".kanji-card")) return;
    var cards = visibleCards();
    var words = uniqueWords(cards);
    var got = countMastered(words);
    var total = document.querySelectorAll(".kanji-card").length;
    var kanjiText = cards.length === total
      ? cards.length + " kanji"
      : "Showing " + cards.length + " of " + total + " kanji";
    summary.textContent = kanjiText + " · " + got + "/" + words.length + " words mastered";
  }

  function lockReadings(locked) {
    document.body.classList.toggle("readings-locked", !!locked);
    document.querySelectorAll(".kanji-reading, .kanji-word-reading").forEach(function (node) {
      if (locked) node.setAttribute("aria-hidden", "true");
      else node.removeAttribute("aria-hidden");
    });
  }

  function startPractice(words, label) {
    var host = document.getElementById("kanji-game");
    if (!host) return;
    lockReadings(false);
    host.replaceChildren();
    var note = document.createElement("p");
    note.className = "game-context";
    var playable = window.JapaneseStudyGame ? JapaneseStudyGame.playableWords(words) : [];
    if (!playable.length) {
      note.textContent = "No kanji words to practice in " + label + ".";
      host.append(note);
      host.scrollIntoView({ block: "start" });
      return;
    }
    note.textContent = "Practicing " + playable.length + (playable.length === 1 ? " word" : " words") + " · " + label + ".";
    host.append(note);
    JapaneseStudyGame.mount(host, words, {
      lockReadings: lockReadings,
      onWordResult: function (item, result) {
        if (window.JapaneseStudyScores) JapaneseStudyScores.record(item.word, item.reading, !!result.firstTry);
      },
      onRoundComplete: function () {
        refreshScores();
      }
    });
    host.scrollIntoView({ block: "start" });
  }
})();
