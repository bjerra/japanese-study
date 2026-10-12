(function () {
  var ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  document.addEventListener("DOMContentLoaded", function () {
    var list = document.getElementById("lesson-list");
    var storiesHost = document.getElementById("stories");
    var status = document.getElementById("status");

    fetch("lessons/index.json")
      .then(function (response) {
        if (!response.ok) throw new Error("Could not load lessons/index.json (" + response.status + ").");
        return response.text();
      })
      .then(function (text) {
        var index = JSON.parse(text.replace(/^\uFEFF/, ""));
        var ids = index && Array.isArray(index.lessons) ? index.lessons : null;
        if (!ids) throw new Error('lessons/index.json must be an object with a "lessons" array of id strings.');
        var stories = index && Array.isArray(index.stories) ? index.stories : [];
        if (!ids.length && !stories.length) {
          status.hidden = false;
          status.textContent = "No lessons yet.";
          return;
        }
        var lessonCards = Promise.all(ids.map(function (id) {
          return loadLesson(id);
        }));
        var storySections = Promise.all(stories.map(function (story) {
          var parts = story && Array.isArray(story.parts) ? story.parts : [];
          return Promise.all(parts.map(function (id) {
            return loadLesson(id);
          })).then(function (cards) {
            return storySection(story, cards);
          });
        }));
        return Promise.all([lessonCards, storySections]);
      })
      .then(function (loaded) {
        if (!loaded) return;
        status.hidden = true;
        loaded[0].forEach(function (card) {
          list.append(card);
        });
        if (loaded[1].length && storiesHost) {
          var kicker = document.createElement("p");
          kicker.className = "page-kicker stories-kicker";
          kicker.textContent = "Stories";
          storiesHost.append(kicker);
          loaded[1].forEach(function (section) {
            storiesHost.append(section);
          });
        }
      })
      .catch(function (error) {
        var hint = location.protocol === "file:"
          ? " Open the site through a local web server, not as a file."
          : "";
        status.hidden = false;
        status.classList.add("error");
        status.textContent = error.message + hint;
      });
  });

  function loadLesson(id) {
    if (!ID_RE.test(id)) {
      return Promise.resolve(messageCard("Index id “" + id + "” is not a lowercase id. Use letters, numbers, and hyphens."));
    }
    return fetch("lessons/" + id + ".json")
      .then(function (response) {
        if (!response.ok) throw new Error("Could not load lessons/" + id + ".json (" + response.status + ").");
        return response.json();
      })
      .then(function (lesson) {
        return lessonCard(id, lesson);
      })
      .catch(function (error) {
        return messageCard(error.message);
      });
  }

  function storySection(story, cards) {
    var section = document.createElement("section");
    section.className = "story-block";

    var title = document.createElement("h2");
    title.className = "story-title";
    title.lang = "ja";
    title.setAttribute("translate", "no");
    title.textContent = (story && story.title) || "Story";
    section.append(title);

    if (story && story.titleReading) {
      var reading = document.createElement("p");
      reading.className = "story-reading";
      reading.lang = "ja";
      reading.setAttribute("translate", "no");
      reading.textContent = story.titleReading;
      section.append(reading);
    }

    var parts = story && Array.isArray(story.parts) ? story.parts : [];
    if (parts.length && window.JapaneseStudyProgress) {
      var progress = document.createElement("p");
      progress.className = "story-progress";
      progress.textContent = JapaneseStudyProgress.countCleared(parts) + "/" + parts.length + " cleared";
      section.append(progress);
    }

    var list = document.createElement("ul");
    list.className = "lesson-list";
    cards.forEach(function (card) {
      list.append(card);
    });
    section.append(list);
    return section;
  }

  function lessonCard(id, lesson) {
    var item = document.createElement("li");
    var link = document.createElement("a");
    link.className = "lesson-card";
    link.href = "lesson.html?id=" + encodeURIComponent(id) + "#reading";
    link.dataset.lessonId = id;

    if (lesson.level) {
      var level = document.createElement("p");
      level.className = "level";
      level.textContent = lesson.level;
      link.append(level);
    }

    var title = document.createElement("h2");
    title.lang = "ja";
    title.setAttribute("translate", "no");
    title.textContent = lesson.title || id;
    link.append(title);

    if (lesson.titleReading) {
      var reading = document.createElement("p");
      reading.className = "card-reading";
      reading.lang = "ja";
      reading.setAttribute("translate", "no");
      reading.textContent = lesson.titleReading;
      link.append(reading);
    }

    if (lesson.summary) {
      var summary = document.createElement("p");
      summary.className = "card-summary";
      summary.textContent = lesson.summary;
      link.append(summary);
    }

    if (window.JapaneseStudyProgress && JapaneseStudyProgress.isCleared(id)) {
      link.classList.add("is-cleared");
      var mark = document.createElement("span");
      mark.className = "cleared-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = "✓";
      var status = document.createElement("span");
      status.className = "sr-only";
      status.textContent = "Cleared";
      link.append(mark, status);
    }

    item.append(link);
    return item;
  }

  function messageCard(text) {
    var item = document.createElement("li");
    var box = document.createElement("p");
    box.className = "panel error";
    box.textContent = text;
    item.append(box);
    return item;
  }
})();
