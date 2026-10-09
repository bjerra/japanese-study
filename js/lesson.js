(function () {
  var ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  var readingsLocked = false;
  var concealedText = new WeakMap();
  var concealedLabels = new WeakMap();

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("lesson");
    var toggle = document.getElementById("toggle-readings");
    var params = new URLSearchParams(location.search);
    var id = params.get("id") || "";

    if (!ID_RE.test(id)) {
      renderMessage(
        main,
        "This page needs a lesson id, for example lesson.html?id=morning-coffee.",
        false
      );
      return;
    }

    fetch("lessons/" + id + ".json")
      .then(function (response) {
        if (!response.ok) throw new Error("Could not load lessons/" + id + ".json (" + response.status + ").");
        return response.text();
      })
      .then(function (text) {
        var lesson = JSON.parse(text.replace(/^\uFEFF/, ""));
        var errors = validate(lesson, id);
        if (errors.length) {
          renderMessage(main, errors.join(" "), true);
          return;
        }
        renderLesson(main, lesson);
        wireReadings(main, toggle);
        wireTranslations(main);
        mountGame(main, lesson.vocabulary || []);
      })
      .catch(function (error) {
        var hint =
          location.protocol === "file:"
            ? " Open the site through a local web server, not as a file."
            : "";
        renderMessage(main, error.message + hint, true);
      });
  });

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

  function renderLesson(main, lesson) {
    document.title = lesson.title + " · Japanese Study";
    main.replaceChildren();

    var back = document.createElement("a");
    back.className = "back";
    back.href = "index.html";
    back.textContent = "All lessons";
    main.append(back);

    var title = document.createElement("h1");
    title.lang = "ja";
    title.setAttribute("translate", "no");
    title.textContent = lesson.title;
    main.append(title);

    if (lesson.titleReading) {
      var reading = document.createElement("p");
      reading.className = "title-reading";
      reading.lang = "ja";
      reading.setAttribute("translate", "no");
      reading.textContent = lesson.titleReading;
      main.append(reading);
    }

    if (lesson.credit && lesson.credit.trim()) {
      main.append(renderCredit(lesson.credit));
    }

    var hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "Tap a word to show or hide its reading.";
    main.append(hint);

    var list = document.createElement("ol");
    list.className = "passage";
    list.id = "passage";
    lesson.sentences.forEach(function (sentence, index) {
      list.append(renderSentence(sentence, index));
    });
    main.append(list);

    var vocabulary = lesson.vocabulary || [];
    if (vocabulary.length) {
      main.append(sectionLabel("Vocabulary"));
      main.append(renderVocabulary(vocabulary));
    }

    var grammar = lesson.grammar || [];
    if (grammar.length) {
      main.append(sectionLabel("Grammar"));
      var notes = document.createElement("div");
      notes.className = "grammar";
      grammar.forEach(function (item) {
        var article = document.createElement("article");
        article.className = "grammar-item";
        var heading = document.createElement("h3");
        heading.textContent = item.title;
        var note = document.createElement("p");
        note.textContent = item.note;
        article.append(heading, note);
        notes.append(article);
      });
      main.append(notes);
    }
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

  function sectionLabel(text) {
    var heading = document.createElement("h2");
    heading.className = "section-label";
    heading.textContent = text;
    return heading;
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

  function wireReadings(main, toggle) {
    var tokens = main.querySelectorAll(".token");
    if (!tokens.length) return;
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

  function mountGame(main, vocabulary) {
    if (!window.JapaneseStudyGame) return;
    var host = document.createElement("div");
    host.id = "vocab-game";
    main.append(host);
    JapaneseStudyGame.mount(host, vocabulary, { lockReadings: lockReadings });
  }

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
