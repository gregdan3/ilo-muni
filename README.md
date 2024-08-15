# ilo Muni

ilo Muni is a graphing tool which displays the occurrence of toki pona words and
phrases over time, as they appear in online toki pona communities. It is based
on the [Google Ngram Viewer](https://books.google.com/ngrams/), but has many
more features (though granted it lacks part of speech tag searching) to help
separate patterns of usage from noise or particularly loud individuals. It
depends on and exists because of two prior tools I made,
[sona toki "language knowledge"](https://github.com/gregdan3/sona-toki) and
[sona mute "frequency knowledge"](https://github.com/gregdan3/sona-mute).

## [More about ilo Muni](https://gregdan3.github.io/ilo-muni/about/)

## [How to use ilo Muni](https://gregdan3.github.io/ilo-muni/help/)

## [Acknowledgements and Thanks](https://gregdan3.github.io/ilo-muni/about/#thank-you-to)

## Future Work

### Quality of Life

- Warn the user when a phrase they search has silly things going on
  - je appears in french
  - ki appears in half a dozen different things that aren't toki pona
- More distinct colors, but not ugly ones
- Bold every August (for toki pona's birthday)
- Always show the last tick on the graph

### New Features

#### Real Input Parser

- The current input parser is kinda bad.
- It works for + and -, but adding onto it would be hell
- It has no awareness of operator precedence or parentheses
- There is no division (because I can't implement it in a sane way without
  operator precedence)
- So I can't do neat things like `ali / (ale + ali)`
- And anyone expecting my input to do cool things like that will actually get a
  result, but a nonsense one!

#### Major Event Annotations

- Toggleable
- Release of pu, ku, su
- Creation of reddit, ma pona, kama sona, facebook group
- Release of notable videos about toki pona (jan misali, oats jenkins)
- Start of pandemic
- Suspiciously large gap starting in feb 2023

## Licenses

I would have distributed these statements in the license files themselves, but
the [licensee library](https://github.com/licensee/licensee) that GitHub uses
doesn't like when I do that. I'd like this software to be identified at a glance
as having these specific licenses, which means adjusting how I deliver this
information.

### AGPL-3.0-or-later

The
[GNU Affero General Public License v3.0 or later](https://www.gnu.org/licenses/agpl-3.0.en.html)
which is [distributed with this software](./LICENSE-AGPL) applies to all
components of this software which are not specified by the adjacent CC-BY-SA-4.0
license.

Copyright (C) 2024 Gregory Danielson III (@gregdan3, gregdan3@pm.me)

### CC-BY-SA-4.0

The
[Creative Commons Attribution Share Alike 4.0 International License](https://creativecommons.org/licenses/by-sa/4.0/)
which is [distributed with this software](./LICENSE-CC-BY-SA) applies to the
following files, files in a specified directory, and files at a specified URL;
each is listed below its original copyright holder.

Copyright (C) 2024 Gregory Danielson III (@gregdan3, gregdan3@pm.me)

- src/pages/about/
- src/pages/help/
- static/buttons/youtube.gif
- static/db/
- https://gregdan3.com/sqlite/2024-08-08-trimmed.sqlite.gz

Copyright (C) 2024 Nia (@nia.co, @yknowlikenia)

- static/favicon-16x16.png
- static/favicon-32x32.png
- static/favicon.ico
- static/favicon.svg
- static/ilo-muni.png

Copyright (C) 2024 Cuymacu (@cuymacu)

- static/buttons/code_s.gif
- static/buttons/lessons_s.gif
