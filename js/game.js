/* Vocabulary spelling game. Tiles come from the lesson's vocabulary readings.
   Small kana (ゃゅょ and the other small vowels) join the kana before them.
   っ, ん, and ー stay separate. See the README. */
(function (root) {
  var SMALL_KANA = {
    "ぁ": 1, "ぃ": 1, "ぅ": 1, "ぇ": 1, "ぉ": 1,
    "ゃ": 1, "ゅ": 1, "ょ": 1, "ゎ": 1, "ゕ": 1, "ゖ": 1,
    "ァ": 1, "ィ": 1, "ゥ": 1, "ェ": 1, "ォ": 1,
    "ャ": 1, "ュ": 1, "ョ": 1, "ヮ": 1, "ヵ": 1, "ヶ": 1
  };

  function chars(value) {
    return Array.from(value);
  }

  function isKanji(ch) {
    var code = ch.codePointAt(0);
    return (
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0x20000 && code <= 0x3ffff) ||
      code === 0x3005 ||
      code === 0x3007
    );
  }

  function hasKanji(text) {
    return chars(text).some(isKanji);
  }

  function kanaTiles(reading) {
    var tiles = [];
    chars(String(reading).replace(/\s+/g, "")).forEach(function (ch) {
      if (SMALL_KANA[ch] && tiles.length) tiles[tiles.length - 1] += ch;
      else tiles.push(ch);
    });
    return tiles;
  }

  function distinctCount(tiles) {
    var seen = Object.create(null);
    var count = 0;
    tiles.forEach(function (tile) {
      if (!seen[tile]) {
        seen[tile] = true;
        count += 1;
      }
    });
    return count;
  }

  function sameSequence(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function shuffledCopy(items) {
    var copy = items.slice();
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function shuffleTiles(tiles) {
    var result = shuffledCopy(tiles);
    if (tiles.length < 2 || distinctCount(tiles) < 2) return result;
    var guard = 0;
    while (sameSequence(result, tiles) && guard < 8) {
      result = shuffledCopy(tiles);
      guard += 1;
    }
    if (sameSequence(result, tiles)) {
      var swapAt = 1;
      while (swapAt < result.length && result[swapAt] === result[0]) swapAt += 1;
      if (swapAt < result.length) {
        var held = result[0];
        result[0] = result[swapAt];
        result[swapAt] = held;
      }
    }
    return result;
  }

  function playableWords(vocabulary) {
    var words = [];
    (vocabulary || []).forEach(function (item) {
      if (!item || typeof item.word !== "string" || typeof item.reading !== "string") return;
      if (!hasKanji(item.word)) return;
      var tiles = kanaTiles(item.reading);
      if (!tiles.length) return;
      words.push({
        word: item.word,
        meaning: typeof item.meaning === "string" ? item.meaning : "",
        tiles: tiles
      });
    });
    return words;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function mount(host, vocabulary, options) {
    var bank = playableWords(vocabulary);
    if (!bank.length) return;
    var lockReadings = options && options.lockReadings ? options.lockReadings : function () {};

    var section = el("section", "game-section");
    section.append(el("h2", "section-label", "Vocabulary game"));
    var card = el("div", "game-card");
    section.append(card);
    host.append(section);

    var round = [];
    var index = 0;
    var score = 0;
    var placed = [];
    var used = [];
    var shuffled = [];
    var missed = false;
    var solved = false;

    card.addEventListener("click", function (event) {
      var target = event.target.closest("button");
      if (!target || !card.contains(target)) return;
      if (target.classList.contains("tile")) placeTile(target);
      else if (target.classList.contains("game-undo")) undo();
      else if (target.classList.contains("game-clear")) clearPlaced();
      else if (target.classList.contains("game-start") || target.classList.contains("game-again")) startRound();
      else if (target.classList.contains("game-next-word")) nextWord();
      else if (target.classList.contains("game-stop")) showIntro();
    });

    showIntro();

    function showIntro() {
      lockReadings(false);
      card.className = "game-card";
      card.replaceChildren();
      card.append(el("p", "game-lead", "Spell each reading. Tap the syllables in order."));
      var start = el("button", "game-next game-start", "Start");
      start.type = "button";
      card.append(start);
    }

    function startRound() {
      round = shuffledCopy(bank);
      index = 0;
      score = 0;
      showQuestion();
    }

    function showQuestion() {
      var item = round[index];
      placed = [];
      used = [];
      shuffled = shuffleTiles(item.tiles);
      missed = false;
      solved = false;
      lockReadings(true);

      card.className = "game-card";
      card.replaceChildren();

      var meta = el("div", "game-meta");
      meta.append(el("span", null, "Word " + (index + 1) + " of " + round.length));
      meta.append(el("span", null, "Score " + score));
      card.append(meta);

      var prompt = el("p", "game-word");
      prompt.lang = "ja";
      prompt.setAttribute("translate", "no");
      prompt.textContent = item.word;
      card.append(prompt);

      var slots = el("div", "game-slots");
      slots.setAttribute("role", "group");
      slots.setAttribute("aria-label", "Answer so far, empty");
      item.tiles.forEach(function () {
        slots.append(el("span", "slot"));
      });
      card.append(slots);

      var tiles = el("div", "game-tiles");
      shuffled.forEach(function (text, tileIndex) {
        var button = el("button", "tile");
        button.type = "button";
        button.lang = "ja";
        button.setAttribute("translate", "no");
        button.dataset.tile = String(tileIndex);
        button.textContent = text;
        button.setAttribute("aria-label", "Syllable " + text);
        tiles.append(button);
      });
      card.append(tiles);

      var actions = el("div", "game-actions");
      var undoBtn = el("button", "game-secondary game-undo", "Undo");
      undoBtn.type = "button";
      var clearBtn = el("button", "game-secondary game-clear", "Clear");
      clearBtn.type = "button";
      actions.append(undoBtn, clearBtn);
      card.append(actions);

      var feedback = el("p", "game-feedback");
      feedback.setAttribute("role", "status");
      feedback.setAttribute("aria-live", "polite");
      card.append(feedback);

      var stop = el("button", "game-text game-stop", "Stop");
      stop.type = "button";
      card.append(stop);

      card.tabIndex = -1;
      section.scrollIntoView({ block: "start" });
    }

    function placeTile(button) {
      if (solved || button.disabled) return;
      var item = round[index];
      if (placed.length >= item.tiles.length) return;
      var tileIndex = Number(button.dataset.tile);
      placed.push(tileIndex);
      used[tileIndex] = true;
      button.disabled = true;
      paint();
      if (placed.length === item.tiles.length) judge();
    }

    function undo() {
      if (solved || !placed.length) return;
      var tileIndex = placed.pop();
      used[tileIndex] = false;
      missed = false;
      paint();
    }

    function clearPlaced() {
      if (solved || !placed.length) return;
      placed = [];
      used = [];
      missed = false;
      paint();
    }

    function paint() {
      var item = round[index];
      var slots = card.querySelector(".game-slots");
      var answer = placed.map(function (tileIndex) { return shuffled[tileIndex]; });
      var wrongShowing = missed && !solved && placed.length === item.tiles.length;
      slots.classList.toggle("is-wrong", wrongShowing);
      slots.classList.toggle("is-right", solved);
      Array.prototype.forEach.call(slots.children, function (slot, slotIndex) {
        var text = answer[slotIndex] || "";
        slot.textContent = text;
        slot.classList.toggle("filled", Boolean(text));
      });
      slots.setAttribute("aria-label", answer.length ? "Answer so far, " + answer.join(" ") : "Answer so far, empty");
      card.querySelectorAll(".tile").forEach(function (button) {
        button.disabled = solved || Boolean(used[Number(button.dataset.tile)]);
      });
      var feedback = card.querySelector(".game-feedback");
      if (feedback && !solved) {
        feedback.classList.toggle("is-bad", wrongShowing);
        if (!wrongShowing) feedback.textContent = "";
      }
    }

    function judge() {
      var item = round[index];
      var answer = placed.map(function (tileIndex) { return shuffled[tileIndex]; });
      var feedback = card.querySelector(".game-feedback");
      if (sameSequence(answer, item.tiles)) {
        solved = true;
        if (!missed) score += 1;
        paint();
        var metaScore = card.querySelector(".game-meta span:last-child");
        if (metaScore) metaScore.textContent = "Score " + score;
        feedback.textContent = "";
        feedback.append(el("span", "game-result", "Correct. "));
        feedback.append(document.createTextNode(item.meaning));
        var actions = card.querySelector(".game-actions");
        actions.replaceChildren();
        var next = el("button", "game-next game-next-word", index + 1 < round.length ? "Next" : "Finish");
        next.type = "button";
        actions.append(next);
        card.querySelector(".game-slots").classList.add("is-right");
      } else {
        missed = true;
        paint();
        feedback.textContent = "Not quite. Undo or clear, then try again.";
      }
    }

    function nextWord() {
      index += 1;
      if (index >= round.length) showEnd();
      else showQuestion();
    }

    function showEnd() {
      lockReadings(false);
      card.className = "game-card";
      card.replaceChildren();
      card.append(el("p", "game-word game-end-title", "Round complete"));
      card.append(el("p", "game-lead", "Score " + score + " / " + round.length + ". A point counts when the reading is right on the first try."));
      var again = el("button", "game-next game-again", "Play again");
      again.type = "button";
      card.append(again);
    }
  }

  root.JapaneseStudyGame = {
    kanaTiles: kanaTiles,
    shuffleTiles: shuffleTiles,
    playableWords: playableWords,
    mount: mount
  };
})(globalThis);
