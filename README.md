# ilo Muni

ilo Muni pi mute nimi, "Word Frequency Tool named Muni" is a tool for graphing
word frequencies in toki pona, based on
[Google Ngrams](https://books.google.com/ngrams/).

## Features

Check the [about page!]()

## Planned QoL

- Warn the user when a phrase they search has silly things going on
  - je appears in french
  - ki appears in half a dozen different things that aren't toki pona
- More distinct colors, but not ugly ones
- Bold every August (for toki pona's birthday)
- Always show the last tick on the graph

## Planned Features

### Real Input Parser

- The current input parser is kinda bad.
- It works for + and -, but adding onto it would be hell
- It has no awareness of operator precedence or parentheses
- There is no division (because I can't implement it in a sane way without
  operator precedence)
- So I can't do neat things like `ali / (ale + ali)`
- And anyone expecting my input to do cool things like that will actually get a
  result, but a nonsense one!

### Major Event Annotations

- Toggleable
- Release of pu, ku, su
- Creation of reddit, ma pona, kama sona, facebook group
- Release of notable videos about toki pona (jan misali, oats jenkins)
- Start of pandemic
- Suspiciously large gap starting in feb 2023

##### Acknowledgements

- Thanks to Phiresky for
  [the unreal capabilities of sql.js-httpvfs](https://github.com/phiresky/sql.js-httpvfs).
- Thanks to Jordemort for
  [figuring out how to use that library in Astro](https://jordemort.dev/blog/client-side-search/))
