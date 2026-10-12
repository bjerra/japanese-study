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

Touch only these things:

1. Create `lessons/<id>.json`.
2. Add `"<id>"` to the `lessons` array in `lessons/index.json`, or, if the lesson is one part of a longer story, add it to that story's `parts` array.

Do not edit HTML, CSS, or JS to add a lesson. Standalone lessons are listed in index order. Parts of a story are listed in `parts` order, and that same order is where the previous and next links come from.

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
| `credit` | no | Source note: author, title, and URL. Shown under the lesson title on the Reading tab. A web address in the text becomes a link. If you shorten the text, split it into parts, or change spelling, say so here. Do not write a vocabulary `reading` in hiragana inside `credit`: the note stays visible while the vocabulary game hides readings. |
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
  ],
  "stories": [
    {
      "title": "桃太郎",
      "titleReading": "ももたろう",
      "parts": ["momotaro-1", "momotaro-2"]
    }
  ]
}
```

`lessons` is standalone lessons. `stories` is optional. Each story has a Japanese `title`, an optional `titleReading`, and `parts`: lesson ids in reading order. Title, summary, level, and credit on each card still come from the lesson file. If `stories` is omitted, the home page lists `lessons` only.

A lesson page looks up its id in `stories` and links **Previous** and **Next** to the neighboring parts. Those links open the Reading tab.

The **Lessons** button in the header, on the home page and on every lesson, opens the same index: standalone lessons first, then each story as a collapsible group. Choosing an entry opens that lesson. The lesson you are on is marked. A new file shows up in the menu once its id is in the index.

**Mark as cleared** sits on each lesson page. Press it again to undo. The choice is stored in this browser only, under the localStorage key `japanese-study-cleared` (a list of lesson ids). Cleared lessons show a checkmark on the home page and in the Lessons menu. Each story shows how many of its parts are cleared, such as `5/18 cleared`. Finishing the vocabulary game offers the same toggle and does not mark the lesson by itself.

Old ids `urashima` and `hanasaka-jijii` still open part 1 (`urashima-1`, `hanasaka-jijii-1`). New parts use the numbered ids.

## What the learner sees

Each lesson has three tabs: **Reading**, **Grammar**, and **Vocab**. Reading is the default. The selected tab is the URL hash (`#reading`, `#grammar`, `#vocab`), so a reload or a shared link keeps it. Any other hash shows Reading. The tabs are buttons in a `tablist`, with `aria-selected` and `aria-controls`.

- **Reading**: title, title reading, credit, previous/next part links, the passage, **Show all readings**, and **Show English** on each sentence.
- **Grammar**: the grammar notes, or a short note when the lesson has none.
- **Vocab**: the word list and the vocabulary game.
- The passage is normal Japanese, with no furigana until asked.
- Tap or click a marked word to show its hiragana above the kanji. Tap again to hide it.
- **Show all readings** / **Hide all readings** toggles every marked word.
- **Show English** / **Hide English** is per sentence.
- The vocabulary game spells each kanji headword from its `reading`. The game needs no extra fields. While a word is still unsolved, furigana, the title reading, and the vocabulary reading column are hidden, including if you switch back to Reading.
- If a lesson has `credit`, that source note is shown under the title.

Tiles are the reading split into kana. A small kana (ゃゅょぁぃぅぇぉゎ, and the katakana forms) stays on the preceding kana, so `きょう` is the tiles `きょ` and `う`. `っ`, `ん`, and `ー` are their own tiles. Repeated kana are repeated tiles. Headwords with no kanji, such as `コーヒー`, are skipped because the prompt would already be the answer.

## Hosting

GitHub Pages, branch `main`, folder `/` (the repo root). There is no build. `.nojekyll` is present so Pages serves the files as-is and does not run Jekyll.

The sample lesson is `lessons/morning-coffee.json`. The folk tales are grouped under `stories` in `lessons/index.json`: 桃太郎, 浦島太郎, and 花咲かじじい, each split into consecutive parts of the full 楠山正雄 text.
