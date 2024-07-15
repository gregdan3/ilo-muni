# lipu mute

"Multiplicity document" or "many pages": a graph of word occurrence in Toki Pona, based on [Google Ngrams](https://books.google.com/ngrams/) but simultaneously more and less ambitious.

## Features

Check the [about page!]()

## Planned QoL

- Telling user when/why their phrases don't show up
- More distinct colors, but not ugly ones
- Bold every August (for Toki Pona's birthday)
- Always show the last tick on the graph

## Planned Fixes

- Move adding/subtracting before relative math to avoid floating point nonsense occurring (example: `tenpo ni - tenpo ni la - lon tenpo ni`, check feb 2019)
- Mobile zoom is super janky

## Planned Features

### Real Input Parser

- The current input parser is kinda bad.
- It works for + and -, but adding onto it would be hell
- It has no awareness of operator precedence or parentheses
- There is no division (because I can't implement it in a sane way without operator precedence)
- So I can't do neat things like `ali / (ale + ali)`
- And anyone expecting my input to do cool things like that will actually get a result, but a nonsense one!

### Major Event Annotations

- Toggleable
- Release of pu, ku, su
- Creation of ma pona, kama sona, facebook group
- Start of pandemic

### Graph of all words ranked

- Probably a bar graph
- Needs a new table with global occurrences (because reading global occurrences of each word from the frequency table would cost words \* timeframes, where i currently have ~80 timeframes)
- Needs to be filterable by sentence length, but nothing else
- Same page or separate page?

### Wildcard Search

- Search input option
- word1 \* word2 gives top results for phrases word1 word3 word2
- Should color them all the same?

<details>
  <summary>notes for me</summary>

1. create global occurrences table [overlapping need with bar graph]
1. count phrase length of input including \*
1. substitute \* for %
1. select from [global occurrence table] where phrase like [given phrase] and phrase_len = found len order by occurrences desc limit 10

</details>

##### Acknowledgements

- Thanks to Phiresky for [the unreal capabilities of sql.js-httpvfs](https://github.com/phiresky/sql.js-httpvfs).
- Thanks to Jordemort for [figuring out how to use that library in Astro](https://jordemort.dev/blog/client-side-search/))
