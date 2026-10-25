# The lie detector

A classroom demonstration of Bayes' rule and the base rate fallacy, served at <https://ditraglia.com/lie-detector/>. It is a companion to [Who's on the other side?](https://ditraglia.com/wotos/).

At a store, 10% of employees are stealing merchandise. The managers' only tool is a lie detector that is 80% accurate: a thief fails it with probability 0.8, and an innocent employee passes it with probability 0.8. If an employee fails the test, what is the probability that the employee is a thief? The answer is 4/13, about 0.31, and most students guess 0.8.

The site has two modes.

- **One at a time** (`#one`) replaces the ten-sided dice. Each student picks an employee on their own device and sees only the lie detector result. A student whose employee failed can then reveal whether the employee is a thief; a student whose employee passed sits the round out. The device keeps a running tally across rounds, so a small class can pool several rounds each.
- **Many at once** (`#many`) tests 1, 10, 100 or 1,000 employees at a time and shows every employee tested and the running estimate. The 4/13 reference line and the explanation stay hidden until "Reveal the answer" is opened. Link straight to it with `https://ditraglia.com/lie-detector/#many`.

Each employee is simulated with two rolls of a ten-sided die, as in the classroom version: the first roll is 0 for a thief, and the second is 0 or 1 when the test gives the wrong result.

## Development

The site is plain HTML, CSS and JavaScript with no build step and no dependencies. To preview locally:

```
python3 -m http.server 8000
```

then open <http://localhost:8000>. The service worker (`sw.js`, for offline use in class) is not registered on `localhost`, so edits show up on a normal reload.

GitHub Pages serves the `main` branch from the repository root.

## Credits

The ninja and angel images are from Microsoft's [Fluent Emoji](https://github.com/microsoft/fluentui-emoji), used under the MIT License (`img/LICENSE-fluent-emoji.txt`).
