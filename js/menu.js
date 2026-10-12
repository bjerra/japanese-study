(function () {
  var ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  var ALIASES = {
    urashima: "urashima-1",
    "hanasaka-jijii": "hanasaka-jijii-1"
  };

  document.addEventListener("DOMContentLoaded", function () {
    var opener = document.getElementById("lesson-menu-open");
    if (!opener) return;

    var dialog = document.createElement("dialog");
    dialog.id = "lesson-menu";
    dialog.className = "lesson-menu";
    dialog.setAttribute("aria-labelledby", "lesson-menu-title");
    document.body.append(dialog);

    var head = document.createElement("div");
    head.className = "lesson-menu-head";
    var title = document.createElement("h2");
    title.id = "lesson-menu-title";
    title.textContent = "Lessons";
    var close = document.createElement("button");
    close.type = "button";
    close.className = "menu-close";
    close.textContent = "Close";
    var kanjiLink = document.createElement("a");
    kanjiLink.className = "menu-kanji";
    kanjiLink.href = "kanji.html";
    kanjiLink.textContent = "Kanji";
    if (/(^|\/)kanji\.html$/.test(location.pathname)) kanjiLink.setAttribute("aria-current", "page");
    head.append(title, kanjiLink, close);

    var body = document.createElement("div");
    body.className = "lesson-menu-body";
    dialog.append(head, body);

    var catalog = null;
    var pending = null;

    opener.addEventListener("click", function () {
      if (dialog.open) {
        dialog.close();
        return;
      }
      opener.setAttribute("aria-expanded", "true");
      dialog.showModal();
      if (catalog) {
        markCurrent(body, currentId());
        applyProgress(body);
        focusCurrent(body, close);
        return;
      }
      showMessage(body, "Loading lessons…");
      pending = pending || loadCatalog().then(function (loaded) {
        catalog = loaded;
        render(body, catalog);
        if (dialog.open) {
          markCurrent(body, currentId());
          focusCurrent(body, close);
        }
      }).catch(function (error) {
        pending = null;
        if (dialog.open) showMessage(body, error.message);
      });
    });

    close.addEventListener("click", function () {
      dialog.close();
    });

    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) {
        dialog.close();
        return;
      }
      var link = event.target.closest && event.target.closest("a");
      if (link && dialog.contains(link)) dialog.close();
    });

    dialog.addEventListener("close", function () {
      opener.setAttribute("aria-expanded", "false");
      opener.focus();
    });
  });

  function currentId() {
    var params = new URLSearchParams(location.search);
    var id = params.get("id") || "";
    return ALIASES[id] || id;
  }

  function loadCatalog() {
    return fetch("lessons/index.json").then(function (response) {
      if (!response.ok) throw new Error("Could not load lessons/index.json (" + response.status + ").");
      return response.text();
    }).then(function (text) {
      var index = JSON.parse(text.replace(/^\uFEFF/, ""));
      var ids = index && Array.isArray(index.lessons) ? index.lessons : null;
      if (!ids) throw new Error('lessons/index.json must be an object with a "lessons" array of id strings.');
      var stories = index && Array.isArray(index.stories) ? index.stories : [];
      var wanted = ids.slice();
      stories.forEach(function (story) {
        var parts = story && Array.isArray(story.parts) ? story.parts : [];
        parts.forEach(function (id) {
          if (wanted.indexOf(id) === -1) wanted.push(id);
        });
      });
      return Promise.all(wanted.map(loadLesson)).then(function (lessons) {
        var byId = {};
        lessons.forEach(function (lesson) {
          byId[lesson.id] = lesson;
        });
        return { ids: ids, stories: stories, byId: byId };
      });
    });
  }

  function loadLesson(id) {
    if (!ID_RE.test(id)) return Promise.resolve({ id: id, title: id, titleReading: "" });
    return fetch("lessons/" + id + ".json").then(function (response) {
      if (!response.ok) throw new Error("missing");
      return response.json();
    }).then(function (lesson) {
      return {
        id: id,
        title: (lesson && lesson.title) || id,
        titleReading: (lesson && lesson.titleReading) || ""
      };
    }).catch(function () {
      return { id: id, title: id, titleReading: "" };
    });
  }

  function render(body, catalog) {
    body.replaceChildren();
    if (!catalog.ids.length && !catalog.stories.length) {
      showMessage(body, "No lessons yet.");
      return;
    }

    if (catalog.ids.length) {
      var standalone = document.createElement("ul");
      standalone.className = "menu-list";
      catalog.ids.forEach(function (id) {
        standalone.append(menuItem(catalog.byId[id] || { id: id, title: id }, true));
      });
      body.append(standalone);
    }

    catalog.stories.forEach(function (story) {
      var parts = story && Array.isArray(story.parts) ? story.parts : [];
      var group = document.createElement("details");
      group.className = "menu-story";
      group.dataset.parts = parts.join(" ");

      var summary = document.createElement("summary");
      var name = document.createElement("span");
      name.className = "menu-story-name";
      name.lang = "ja";
      name.setAttribute("translate", "no");
      name.textContent = (story && story.title) || "Story";
      summary.append(name);
      if (story && story.titleReading) {
        var reading = document.createElement("span");
        reading.className = "menu-story-reading";
        reading.lang = "ja";
        reading.setAttribute("translate", "no");
        reading.textContent = story.titleReading;
        summary.append(reading);
      }
      var count = document.createElement("span");
      count.className = "menu-story-count";
      count.textContent = String(parts.length);
      summary.append(count);
      group.append(summary);

      var list = document.createElement("ul");
      list.className = "menu-list";
      parts.forEach(function (id) {
        list.append(menuItem(catalog.byId[id] || { id: id, title: id }, false));
      });
      group.append(list);
      body.append(group);
    });

    markCurrent(body, currentId());
    applyProgress(body);
  }

  function menuItem(lesson, withReading) {
    var item = document.createElement("li");
    var link = document.createElement("a");
    link.className = "menu-link";
    link.href = "lesson.html?id=" + encodeURIComponent(lesson.id) + "#reading";
    link.dataset.lessonId = lesson.id;

    var label = document.createElement("span");
    label.className = "menu-link-title";
    label.lang = "ja";
    label.setAttribute("translate", "no");
    label.textContent = lesson.title || lesson.id;
    link.append(label);

    if (withReading && lesson.titleReading) {
      var reading = document.createElement("span");
      reading.className = "menu-link-reading";
      reading.lang = "ja";
      reading.setAttribute("translate", "no");
      reading.textContent = lesson.titleReading;
      link.append(reading);
    }

    item.append(link);
    return item;
  }

  function markCurrent(body, id) {
    body.querySelectorAll(".menu-link").forEach(function (link) {
      var on = !!id && link.dataset.lessonId === id;
      link.classList.toggle("is-current", on);
      if (on) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
      var badge = link.querySelector(".menu-current");
      if (on && !badge) {
        badge = document.createElement("span");
        badge.className = "menu-current";
        badge.textContent = "Current";
        link.append(badge);
      } else if (!on && badge) {
        badge.remove();
      }
    });
    body.querySelectorAll(".menu-story").forEach(function (group) {
      group.open = !!id && !!group.querySelector('.menu-link[data-lesson-id="' + cssEscape(id) + '"]');
    });
  }

  function applyProgress(body) {
    var progress = window.JapaneseStudyProgress;
    if (!progress) return;
    var map = progress.clearedMap();
    body.querySelectorAll(".menu-link").forEach(function (link) {
      var on = !!map[link.dataset.lessonId];
      link.classList.toggle("is-cleared", on);
      var mark = link.querySelector(".menu-cleared");
      var label = link.querySelector(".menu-cleared-label");
      if (on && !mark) {
        mark = document.createElement("span");
        mark.className = "menu-cleared";
        mark.setAttribute("aria-hidden", "true");
        mark.textContent = "✓";
        label = document.createElement("span");
        label.className = "menu-cleared-label sr-only";
        label.textContent = "Cleared";
        var badge = link.querySelector(".menu-current");
        if (badge) link.insertBefore(mark, badge);
        else link.append(mark);
        link.append(label);
      } else if (!on) {
        if (mark) mark.remove();
        if (label) label.remove();
      }
    });
    body.querySelectorAll(".menu-story").forEach(function (group) {
      var ids = (group.dataset.parts || "").split(" ").filter(Boolean);
      var count = group.querySelector(".menu-story-count");
      if (!count) return;
      count.textContent = progress.countCleared(ids) + "/" + ids.length + " cleared";
    });
  }

  function focusCurrent(body, close) {
    var current = body.querySelector(".menu-link.is-current");
    if (!current) {
      close.focus();
      return;
    }
    var group = current.closest(".menu-story");
    if (group) group.open = true;
    current.focus();
    var scroller = body;
    var top = current.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollTop += top - scroller.clientHeight / 2 + current.offsetHeight / 2;
  }

  function showMessage(body, text) {
    body.replaceChildren();
    var note = document.createElement("p");
    note.className = "menu-message";
    note.textContent = text;
    body.append(note);
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }
})();
