(function () {
  var ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  var ALIASES = {
    urashima: "urashima-1",
    "hanasaka-jijii": "hanasaka-jijii-1"
  };
  var TABS = [
    { id: "reading", label: "Reading" },
    { id: "grammar", label: "Grammar" },
    { id: "vocab", label: "Vocab" }
  ];
  var readingsLocked = false;
  var concealedText = new WeakMap();
  var concealedLabels = new WeakMap();
  var selectTab = function () {};

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("lesson");
    var params = new URLSearchParams(location.search);
    var requestedId = params.get("id") || "";
    var id = ALIASES[requestedId] || requestedId;

    window.addEventListener("hashchange", function () {
      selectTab(tabFromHash(), false);
    });

    if (!ID_RE.test(requestedId) || !ID_RE.test(id)) {
      renderMessage(
        main,
        "This page needs a lesson id, for example lesson.html?id=morning-coffee.",
        false
      );
      return;
    }

    Promise.all([fetchLesson(id), fetchIndex()])
      .then(function (loaded) {
        var lesson = loaded[0];
        var errors = validate(lesson, id);
        if (errors.length) {
          renderMessage(main, errors.join(" "), true);
          return;
        }
        renderLesson(main, lesson, findNeighbors(loaded[1], id));
        wireReadings(main);
        wireTranslations(main);
        mountGame(document.getElementById("panel-vocab"), lesson.vocabulary || [], lesson.id);
        selectTab(tabFromHash(), false);
      })
      .catch(function (error) {
        var hint =
          location.protocol === "file:"
            ? " Open the site through a local web server, not as a file."
            : "";
        renderMessage(main, error.message + hint, true);
      });
  });

  function fetchLesson(id) {
    return fetch("lessons/" + id + ".json").then(function (response) {
      if (!response.ok) throw new Error("Could not load lessons/" + id + ".json (" + response.status + ").");
      return response.text();
    }).then(function (text) {
      return JSON.parse(text.replace(/^\uFEFF/, ""));
    });
  }

  function fetchIndex() {
    return fetch("lessons/index.json")
      .then(function (response) {
        if (!response.ok) return null;
        return response.json();
      })
      .catch(function () {
        return null;
      });
  }

  function findNeighbors(index, id) {
    var stories = index && Array.isArray(index.stories) ? index.stories : [];
    for (var s = 0; s < stories.length; s++) {
      var parts = stories[s] && Array.isArray(stories[s].parts) ? stories[s].parts : [];
      var at = parts.indexOf(id);
      if (at === -1) continue;
      return {
        prev: at > 0 ? parts[at - 1] : "",
        next: at < parts.length - 1 ? parts[at + 1] : ""
      };
    }
    return { prev: "", next: "" };
  }

  function tabFromHash() {
    var name = (location.hash || "").replace(/^#/, "");
    var known = TABS.some(function (tab) { return tab.id === name; });
    return known ? name : "reading";
  }

  function validate(lesson, id) {
    var errors = [];
    if (!lesson || typeof lesson !== "object" || Array.isArray(lesson)) {
      return ["Lesson file must be a JSON object."];
    }
    if (lesson.id !== id) {
      errors.push('The "id" field must be "' + id + '" to match the file name.');
    }
    if (typeof lesson.title !== "string" || !lesson.title.trim()) {
      errors.push('Add a non-empty "title" string.');
    } else if (lesson.title.indexOf("{") !== -1 || lesson.title.indexOf("｛") !== -1) {
      errors.push('Keep "title" as plain Japanese. Put its reading in "titleReading".');
    }
    if (!Array.isArray(lesson.sentences) || lesson.sentences.length === 0) {
      errors.push('Add a non-empty "sentences" array.');
    } else {
      lesson.sentences.forEach(function (sentence, index) {
        var label = "sentences[" + index + "]";
        if (!sentence || typeof sentence !== "object") {
          errors.push(label + " must be an object with jp and en.");
          return;
        }
        if (typeof sentence.jp !== "string" || !sentence.jp.trim()) {
          errors.push(label + '.jp must be a non-empty string. Use 漢字{かんじ} for readings.');
        }
        if (typeof sentence.en !== "string" || !sentence.en.trim()) {
          errors.push(label + ".en must be a non-empty English string.");
        }
      });
    }
    if (lesson.vocabulary != null && !Array.isArray(lesson.vocabulary)) {
      errors.push('"vocabulary" must be an array.');
    } else {
      (lesson.vocabulary || []).forEach(function (item, index) {
        checkFields(errors, item, "vocabulary[" + index + "]", ["word", "reading", "meaning"]);
        if (item && typeof item.word === "string" && (item.word.indexOf("{") !== -1 || item.word.indexOf("｛") !== -1)) {
          errors.push("vocabulary[" + index + '].word must be plain text. Put the reading in "reading".');
        }
      });
    }
    if (lesson.grammar != null && !Array.isArray(lesson.grammar)) {
      errors.push('"grammar" must be an array.');
    } else {
      (lesson.grammar || []).forEach(function (item, index) {
        checkFields(errors, item, "grammar[" + index + "]", ["title", "note"]);
      });
    }
    ["titleReading", "summary", "level", "credit"].forEach(function (key) {
      if (lesson[key] != null && typeof lesson[key] !== "string") {
        errors.push('"' + key + '" must be a string.');
      }
    });
    return errors;
  }

  function checkFields(errors, item, label, keys) {
    if (!item || typeof item !== "object") {
      errors.push(label + " must be an object.");
      return;
    }
    keys.forEach(function (key) {
      if (typeof item[key] !== "string" || !item[key].trim()) {
        errors.push(label + "." + key + " must be a non-empty string.");
      }
    });
  }

  function renderMessage(main, text, isError) {
    main.replaceChildren();
    var box = document.createElement("p");
    box.className = isError ? "panel error" : "panel";
    box.textContent = text;
    var back = document.createElement("p");
    var link = document.createElement("a");
    link.href = "index.html";
    link.textContent = "All lessons";
    back.append(link);
    main.append(back, box);
  }

  function renderLesson(main, lesson, neighbors) {
    document.title = lesson.title + " · Japanese Study";
    main.replaceChildren();

    var back = document.createElement("a");
    back.className = "back";
    back.href = "index.html";
    back.textContent = "All lessons";
    main.append(back);
    main.append(clearedToggle(lesson.id));

    var tablist = document.createElement("div");
    tablist.className = "lesson-tabs";
    tablist.setAttribute("role", "tablist");
    tablist.setAttribute("aria-label", "Lesson sections");
    tablist.setAttribute("aria-orientation", "horizontal");

    var panels = {};
    TABS.forEach(function (tab) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "lesson-tab";
      button.id = "tab-" + tab.id;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", "panel-" + tab.id);
      button.setAttribute("aria-selected", "false");
      button.tabIndex = -1;
      button.textContent = tab.label;
      button.addEventListener("click", function () {
        selectTab(tab.id, true);
      });
      tablist.append(button);

      var panel = document.createElement("div");
      panel.className = "lesson-panel";
      panel.id = "panel-" + tab.id;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", button.id);
      panel.hidden = true;
      panels[tab.id] = panel;
    });
    main.append(tablist);

    tablist.addEventListener("keydown", function (event) {
      var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));
      var index = tabs.indexOf(document.activeElement);
      if (index < 0) return;
      var next = -1;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault();
      var name = tabs[next].id.replace(/^tab-/, "");
      selectTab(name, true);
      tabs[next].focus();
    });

    fillReading(panels.reading, lesson, neighbors);
    fillGrammar(panels.grammar, lesson.grammar || []);
    fillVocab(panels.vocab, lesson.vocabulary || []);
    TABS.forEach(function (tab) {
      main.append(panels[tab.id]);
    });

    selectTab = function (name, writeHash) {
      if (!panels[name]) name = "reading";
      TABS.forEach(function (tab) {
        var on = tab.id === name;
        panels[tab.id].hidden = !on;
        var button = document.getElementById("tab-" + tab.id);
        button.setAttribute("aria-selected", on ? "true" : "false");
        button.tabIndex = on ? 0 : -1;
      });
      if (writeHash && location.hash !== "#" + name) {
        history.replaceState(null, "", location.pathname + location.search + "#" + name);
      }
    };
  }

  function fillReading(panel, lesson, neighbors) {
    var title = document.createElement("h1");
    title.lang = "ja";
    title.setAttribute("translate", "no");
    title.textContent = lesson.title;
    panel.append(title);

    if (lesson.titleReading) {
      var reading = document.createElement("p");
      reading.className = "title-reading";
      reading.lang = "ja";
      reading.setAttribute("translate", "no");
      reading.textContent = lesson.titleReading;
      panel.append(reading);
    }

    if (lesson.credit && lesson.credit.trim()) {
      panel.append(renderCredit(lesson.credit));
    }

    var topNav = renderPartNav(neighbors);
    if (topNav) panel.append(topNav);

    var tools = document.createElement("div");
    tools.className = "reading-tools";
    var toggle = document.createElement("button");
    toggle.id = "toggle-readings";
    toggle.type = "button";
    toggle.hidden = true;
    toggle.textContent = "Show all readings";
    tools.append(toggle);
    panel.append(tools);

    var hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "Tap a word to show or hide its reading.";
    panel.append(hint);

    var list = document.createElement("ol");
    list.className = "passage";
    list.id = "passage";
    lesson.sentences.forEach(function (sentence, index) {
      list.append(renderSentence(sentence, index));
    });
    panel.append(list);

    var bottomNav = renderPartNav(neighbors);
    if (bottomNav) panel.append(bottomNav);
  }

  function fillGrammar(panel, grammar) {
    if (!grammar.length) {
      panel.append(emptyNote("This lesson has no grammar notes."));
      return;
    }
    var notes = document.createElement("div");
    notes.className = "grammar";
    grammar.forEach(function (item) {
      var article = document.createElement("article");
      article.className = "grammar-item";
      var heading = document.createElement("h2");
      heading.textContent = item.title;
      var note = document.createElement("p");
      note.textContent = item.note;
      article.append(heading, note);
      notes.append(article);
    });
    panel.append(notes);
  }

  function fillVocab(panel, vocabulary) {
    if (!vocabulary.length) {
      panel.append(emptyNote("This lesson has no vocabulary list."));
    } else {
      panel.append(renderVocabulary(vocabulary));
    }
    var host = document.createElement("div");
    host.id = "vocab-game";
    panel.append(host);
  }

  function emptyNote(text) {
    var note = document.createElement("p");
    note.className = "empty-note";
    note.textContent = text;
    return note;
  }

  function renderPartNav(neighbors) {
    if (!neighbors || (!neighbors.prev && !neighbors.next)) return null;
    var nav = document.createElement("nav");
    nav.className = "part-nav";
    nav.setAttribute("aria-label", "Story parts");
    if (neighbors.prev) nav.append(partLink(neighbors.prev, "Previous", "Previous part"));
    if (neighbors.next) nav.append(partLink(neighbors.next, "Next", "Next part", "next"));
    return nav;
  }

  function partLink(id, label, aria, className) {
    var link = document.createElement("a");
    if (className) link.className = className;
    link.href = "lesson.html?id=" + encodeURIComponent(id) + "#reading";
    link.textContent = label;
    link.setAttribute("aria-label", aria);
    return link;
  }

  function renderCredit(credit) {
    var note = document.createElement("p");
    note.className = "credit";
    var pattern = /https?:\/\/[^\s]+/g;
    var last = 0;
    var match;
    while ((match = pattern.exec(credit)) !== null) {
      if (match.index > last) {
        note.append(document.createTextNode(credit.slice(last, match.index)));
      }
      var href = match[0].replace(/[)。、.]+$/u, "");
      var trailing = match[0].slice(href.length);
      var link = document.createElement("a");
      link.href = href;
      link.textContent = href;
      link.rel = "noopener noreferrer";
      link.target = "_blank";
      note.append(link);
      if (trailing) note.append(document.createTextNode(trailing));
      last = match.index + match[0].length;
    }
    if (last < credit.length) note.append(document.createTextNode(credit.slice(last)));
    return note;
  }

  function renderSentence(sentence, index) {
    var item = document.createElement("li");
    item.className = "sentence";

    var jp = document.createElement("p");
    jp.className = "sentence-jp";
    jp.lang = "ja";
    jp.setAttribute("translate", "no");
    JapaneseStudy.tokenize(sentence.jp).forEach(function (part) {
      if (part.type === "text") {
        jp.append(document.createTextNode(part.text));
        return;
      }
      var button = document.createElement("button");
      button.type = "button";
      button.className = "token";
      button.dataset.reading = part.reading;
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", part.base + ", show reading " + part.reading);
      var ruby = document.createElement("ruby");
      ruby.append(document.createTextNode(part.base));
      button.append(ruby);
      jp.append(button);
    });

    var reveal = document.createElement("button");
    reveal.type = "button";
    reveal.className = "reveal";
    reveal.textContent = "Show English";
    reveal.setAttribute("aria-expanded", "false");
    reveal.setAttribute("aria-controls", "en-" + index);

    var en = document.createElement("p");
    en.className = "en";
    en.id = "en-" + index;
    en.lang = "en";
    en.hidden = true;
    en.textContent = sentence.en;

    item.append(jp, reveal, en);
    return item;
  }

  function renderVocabulary(items) {
    var list = document.createElement("ul");
    list.className = "vocab";

    var head = document.createElement("li");
    head.className = "vocab-head";
    head.setAttribute("aria-hidden", "true");
    ["Word", "Reading", "Meaning"].forEach(function (label) {
      var span = document.createElement("span");
      span.textContent = label;
      if (label === "Reading") span.className = "vocab-head-reading";
      head.append(span);
    });
    list.append(head);

    items.forEach(function (item) {
      var row = document.createElement("li");
      row.className = "vocab-item";
      var word = document.createElement("span");
      word.className = "vocab-word";
      word.lang = "ja";
      word.setAttribute("translate", "no");
      word.textContent = item.word;
      var reading = document.createElement("span");
      reading.className = "vocab-reading";
      reading.lang = "ja";
      reading.setAttribute("translate", "no");
      reading.textContent = item.reading;
      var meaning = document.createElement("span");
      meaning.className = "vocab-meaning";
      meaning.textContent = item.meaning;
      row.append(word, reading, meaning);
      list.append(row);
    });
    return list;
  }

  function wireReadings(main) {
    var toggle = document.getElementById("toggle-readings");
    var tokens = main.querySelectorAll(".token");
    if (!tokens.length || !toggle) return;
    toggle.hidden = false;
    toggle.setAttribute("aria-pressed", "false");
    toggle.setAttribute("aria-controls", "passage");

    main.addEventListener("click", function (event) {
      if (readingsLocked) return;
      var button = event.target.closest(".token");
      if (!button || !main.contains(button)) return;
      setToken(button, !button.classList.contains("is-on"));
      syncToggle(main, toggle);
    });

    toggle.addEventListener("click", function () {
      if (readingsLocked) return;
      var turnOn = toggle.getAttribute("aria-pressed") !== "true";
      main.querySelectorAll(".token").forEach(function (button) {
        setToken(button, turnOn);
      });
      syncToggle(main, toggle);
    });
  }

  function mountGame(host, vocabulary, lessonId) {
    if (!window.JapaneseStudyGame || !host) return;
    JapaneseStudyGame.mount(host, vocabulary, {
      lockReadings: lockReadings,
      onRoundComplete: function (card) {
        var offer = document.createElement("p");
        offer.className = "game-offer";
        offer.textContent = "Finished the round. Mark this lesson as cleared if you want.";
        card.append(offer);
        card.append(clearedToggle(lessonId));
      }
    });
  }

  function clearedToggle(id) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "cleared-toggle";
    button.dataset.lessonId = id;
    paintClearedToggle(button);
    button.addEventListener("click", function () {
      if (!window.JapaneseStudyProgress) return;
      JapaneseStudyProgress.setCleared(id, button.getAttribute("aria-pressed") !== "true");
    });
    return button;
  }

  function paintClearedToggle(button) {
    var id = button.dataset.lessonId;
    var on = !!(window.JapaneseStudyProgress && JapaneseStudyProgress.isCleared(id));
    button.setAttribute("aria-pressed", on ? "true" : "false");
    button.textContent = on ? "Cleared" : "Mark as cleared";
  }

  window.addEventListener("japanese-study-cleared", function () {
    document.querySelectorAll(".cleared-toggle").forEach(paintClearedToggle);
  });

  function lockReadings(locked) {
    var toggle = document.getElementById("toggle-readings");
    if (locked) {
      readingsLocked = true;
      document.body.classList.add("readings-locked");
      document.querySelectorAll(".token.is-on").forEach(function (button) {
        setToken(button, false);
      });
      document.querySelectorAll(".token").forEach(concealToken);
      document.querySelectorAll(".vocab-reading, .title-reading").forEach(concealText);
      if (toggle) toggle.disabled = true;
      return;
    }
    document.querySelectorAll(".token").forEach(restoreToken);
    document.querySelectorAll(".vocab-reading, .title-reading").forEach(restoreText);
    readingsLocked = false;
    document.body.classList.remove("readings-locked");
    if (toggle) toggle.disabled = false;
  }

  function concealText(node) {
    if (concealedText.has(node)) return;
    concealedText.set(node, node.textContent);
    node.textContent = "";
    node.setAttribute("aria-hidden", "true");
  }

  function restoreText(node) {
    if (!concealedText.has(node)) return;
    node.textContent = concealedText.get(node);
    concealedText.delete(node);
    node.removeAttribute("aria-hidden");
  }

  function concealToken(button) {
    if (!concealedLabels.has(button)) {
      concealedLabels.set(button, {
        label: button.getAttribute("aria-label") || "",
        reading: button.dataset.reading || ""
      });
    }
    delete button.dataset.reading;
    var base = button.querySelector("ruby").firstChild;
    button.setAttribute("aria-label", base ? base.textContent : "");
  }

  function restoreToken(button) {
    var saved = concealedLabels.get(button);
    if (!saved) return;
    if (saved.reading) button.dataset.reading = saved.reading;
    button.setAttribute("aria-label", saved.label);
    concealedLabels.delete(button);
  }

  function setToken(button, on) {
    var ruby = button.querySelector("ruby");
    var existing = ruby.querySelector("rt");
    if (on && !existing) {
      var rt = document.createElement("rt");
      rt.textContent = button.dataset.reading;
      ruby.append(rt);
    } else if (!on && existing) {
      existing.remove();
    }
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
    var base = ruby.childNodes[0] ? ruby.childNodes[0].textContent : "";
    button.setAttribute(
      "aria-label",
      base + (on ? ", hide reading " : ", show reading ") + button.dataset.reading
    );
  }

  function syncToggle(main, toggle) {
    var tokens = main.querySelectorAll(".token");
    var allOn = tokens.length > 0 && Array.prototype.every.call(tokens, function (button) {
      return button.classList.contains("is-on");
    });
    toggle.setAttribute("aria-pressed", allOn ? "true" : "false");
    toggle.textContent = allOn ? "Hide all readings" : "Show all readings";
  }

  function wireTranslations(main) {
    main.addEventListener("click", function (event) {
      var button = event.target.closest(".reveal");
      if (!button || !main.contains(button)) return;
      var panel = document.getElementById(button.getAttribute("aria-controls"));
      var open = panel.hidden;
      panel.hidden = !open;
      button.setAttribute("aria-expanded", open ? "true" : "false");
      button.textContent = open ? "Hide English" : "Show English";
    });
  }
})();
