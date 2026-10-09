/* Reading notation for lesson sentences. See README.
   {reading} binds to the kanji word that ends at the brace, so unmarked
   text may sit between words: 私{わたし}は飲{の}みます。
   Okurigana may be written 飲{の}みます or 飲みます{のみます}. */
(function (root) {
  function chars(value) {
    return Array.from(value);
  }

  function isKana(ch) {
    var code = ch.codePointAt(0);
    return (
      (code >= 0x3041 && code <= 0x3096) ||
      (code >= 0x30a1 && code <= 0x30fa) ||
      code === 0x30fc
    );
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

  function alignReading(surface, reading) {
    var s = chars(surface);
    var r = chars(reading);
    var sEnd = s.length;
    var rEnd = r.length;

    while (
      sEnd > 0 &&
      rEnd > 0 &&
      s[sEnd - 1] === r[rEnd - 1] &&
      isKana(s[sEnd - 1])
    ) {
      sEnd -= 1;
      rEnd -= 1;
    }

    var sStart = 0;
    var rStart = 0;
    while (
      sStart < sEnd &&
      rStart < rEnd &&
      s[sStart] === r[rStart] &&
      isKana(s[sStart])
    ) {
      sStart += 1;
      rStart += 1;
    }

    return {
      prefix: s.slice(0, sStart).join(""),
      base: s.slice(sStart, sEnd).join(""),
      reading: r.slice(rStart, rEnd).join(""),
      suffix: s.slice(sEnd).join(""),
    };
  }

  /* The {reading} belongs to a suffix of the text before it, not to all of that text. */
  function splitChunk(chunk, reading) {
    var c = chars(chunk);
    var r = chars(reading);
    if (!c.length) return null;

    var end = c.length;
    var readEnd = r.length;
    while (
      end > 0 &&
      readEnd > 0 &&
      c[end - 1] === r[readEnd - 1] &&
      isKana(c[end - 1])
    ) {
      end -= 1;
      readEnd -= 1;
    }

    var start = end;
    while (start > 0 && isKanji(c[start - 1])) start -= 1;

    if (start === end) {
      while (start > 0 && isKana(c[start - 1])) start -= 1;
      if (start === c.length) return null;
    } else {
      var kanjiStart = start;
      while (start > 0 && isKana(c[start - 1])) {
        var prefix = c.slice(start - 1, kanjiStart).join("");
        var remaining = r.slice(0, readEnd).join("");
        if (remaining.indexOf(prefix) === 0) start -= 1;
        else break;
      }
    }

    return {
      leading: c.slice(0, start).join(""),
      surface: c.slice(start).join(""),
    };
  }

  function pushText(parts, text) {
    if (!text) return;
    var last = parts[parts.length - 1];
    if (last && last.type === "text") last.text += text;
    else parts.push({ type: "text", text: text });
  }

  function emitSurface(parts, surface, reading) {
    var aligned = alignReading(surface, reading);
    pushText(parts, aligned.prefix);
    if (aligned.base && aligned.reading) {
      parts.push({
        type: "ruby",
        base: aligned.base,
        reading: aligned.reading,
      });
    } else {
      pushText(parts, aligned.base);
    }
    pushText(parts, aligned.suffix);
  }

  function tokenize(text) {
    var source = String(text)
      .replace(/^\uFEFF/, "")
      .replaceAll("｛", "{")
      .replaceAll("｝", "}");
    var parts = [];
    var re = /\{([^{}]*)\}/g;
    var cursor = 0;
    var match;

    while ((match = re.exec(source)) !== null) {
      var chunk = source.slice(cursor, match.index);
      var reading = match[1].trim();
      if (!reading) {
        pushText(parts, chunk);
      } else {
        var split = splitChunk(chunk, reading);
        if (!split) {
          pushText(parts, chunk + match[0]);
        } else {
          pushText(parts, split.leading);
          emitSurface(parts, split.surface, reading);
        }
      }
      cursor = match.index + match[0].length;
    }

    pushText(parts, source.slice(cursor));
    return parts;
  }

  root.JapaneseStudy = {
    tokenize: tokenize,
    alignReading: alignReading,
  };
})(globalThis);
