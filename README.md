# Japanese Study

A small static site for Japanese reading practice. The learner pastes a text to a coach; the coach turns it into a lesson file and adds that file to this repo. GitHub Pages serves the site from the `main` branch root (no build step).

Published URL: <https://bjerra.github.io/japanese-study/>

Kanji are shown as ordinary Japanese. A reading appears above a word only after that word is tapped, or after **Show all readings**. English stays hidden until **Show English** on that sentence.

## Preview locally

From the repo root:

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000/> (home) and <http://localhost:8000/lesson.html?id=morning-coffee> (sample lesson).

Fetch is blocked on `file://`, so open the site through a local server or GitHub Pages. Paths are relative and work at the project-site prefix `/japanese-study/`.

## Add a lesson

Touch only these two things:

1. Create `lessons/<id>.json`.
2. Add `"<id>"` to the `lessons` array in `lessons/index.json`.

Do not edit HTML, CSS, or JS to add a lesson. The home page lists ids in the order they appear in the index.

`<id>` rules:

- Lowercase English letters, digits, and single hyphens. Example: `station-morning`.
- Must match the file name (`lessons/station-morning.json`) and the `"id"` field inside the file.
- Must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`.

After adding it, reload the home page, open the lesson, tap each marked word, and check the reading and the English.

## Lesson file format

UTF-8 JSON. No comments and no trailing commas. Unknown fields are ignored.

| Field | Required | What it is |
| --- | --- | --- |
| `id` | yes | Same string as the file name. |
| `title` | yes | Plain Japanese title. No `{readings}` here. |
| `titleReading` | no | Hiragana (and katakana) for the whole title. Shown under the title. |
| `summary` | no | One English sentence on the home page card. |
| `level` | no | Short label such as `beginner` or `intermediate`. |
| `credit` | no | Source note: author, title, and URL. Shown under the lesson title. A web address in the text becomes a link. If you shorten the text or modernise spelling, say so here. |
| `sentences` | yes | Non-empty array. One object per sentence (or short paragraph). |
| `sentences[].jp` | yes | Japanese with `漢字{かんじ}` readings. Braces are source notation; learners never see the braces. |
| `sentences[].en` | yes | English for that sentence. Hidden until the learner reveals it. |
| `vocabulary` | no | Array of `{ "word", "reading", "meaning" }`. Omitted means none. List dictionary form for verbs (`飲む`, not `飲みます`). |
| `grammar` | no | Array of `{ "title", "note" }`. Omitted means none. Keep each note short. |

`word`, `reading`, and `meaning` are separate strings. Do not put `{かな}` inside vocabulary fields.

### Reading notation

In `sentences[].jp` only, write the reading in ASCII braces immediately after the word. You do not need spaces. The braces belong to the kanji word that ends at `{`, and the text before that word stays plain:

```text
今日{きょう}はいい天気{てんき}です。
私{わたし}はコーヒーを飲{の}みます。
```

That displays as normal Japanese: 今日, 天気, 私, and 飲 can be tapped. Learners never see the braces. は, コーヒー, and を are unmarked.

A run of kanji is one word: `日本語{にほんご}`, `友達{ともだち}`. To mark parts of a compound separately, put a reading on each part: `東{とう}京{きょう}`.

Fullwidth braces work too: `今日｛きょう｝`.

Put punctuation outside the braces: `朝{あさ}、私{わたし}は…` and `天気{てんき}です。`

Okurigana — both of these put の above 飲 only:

```text
飲{の}みます
飲みます{のみます}
```

When the reading repeats the okurigana, use the same kana as the word (hiragana, in the usual case). A kana prefix works the same way: `お名前{おなまえ}` shows なまえ above 名前.

Do not write `飲みます{の}` or `勉強します{べんきょう}`. Either put the reading on the kanji only (`飲{の}みます`, `勉強{べんきょう}します`) or repeat the okurigana inside the braces (`飲みます{のみます}`).

You can mark a kana word when the pronunciation is the point, for example the particle `は{わ}`.

Leave words with no extra reading unmarked (`コーヒー`, `です`, `それから`). An empty `{}` is ignored. Do not nest braces.

### Template

```json
{
  "id": "your-lesson-id",
  "title": "レッスンの題名",
  "titleReading": "れっすんのだいめい",
  "summary": "One sentence shown on the home page.",
  "level": "beginner",
  "credit": "Author, title. https://example.com/source . Excerpt; say what you changed.",
  "sentences": [
    {
      "jp": "私{わたし}は学生{がくせい}です。",
      "en": "I am a student."
    }
  ],
  "vocabulary": [
    { "word": "私", "reading": "わたし", "meaning": "I; me" },
    { "word": "学生", "reading": "がくせい", "meaning": "student" }
  ],
  "grammar": [
    {
      "title": "は — topic marker",
      "note": "は marks the topic. As a particle it is pronounced わ."
    }
  ]
}
```

## Index

`lessons/index.json`:

```json
{
  "lessons": [
    "morning-coffee",
    "your-lesson-id"
  ]
}
```

Each entry is only the id string. Title, reading, summary, level, and credit come from the lesson file.

## What the learner sees

- The passage is normal Japanese, with no furigana until asked.
- Tap or click a marked word to show its hiragana above the kanji. Tap again to hide it.
- **Show all readings** / **Hide all readings** toggles every marked word.
- **Show English** / **Hide English** is per sentence.
- Vocabulary shows word, reading, and meaning. Grammar notes are always visible.
- A vocabulary game at the bottom of the lesson spells each kanji headword from its `reading`. The game needs no extra fields. While a word is still unsolved, furigana, the title reading, and the vocabulary reading column are hidden.
- If a lesson has `credit`, that source note is shown under the title.

Tiles are the reading split into kana. A small kana (ゃゅょぁぃぅぇぉゎ, and the katakana forms) stays on the preceding kana, so `きょう` is the tiles `きょ` and `う`. `っ`, `ん`, and `ー` are their own tiles. Repeated kana are repeated tiles. Headwords with no kanji, such as `コーヒー`, are skipped because the prompt would already be the answer.

## Hosting

GitHub Pages, branch `main`, folder `/` (the repo root). There is no build. `.nojekyll` is present so Pages serves the files as-is and does not run Jekyll.

The sample lesson is `lessons/morning-coffee.json`.
