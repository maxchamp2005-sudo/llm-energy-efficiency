# Measuring electricity per LLM token

**Team AC/DC**

At this hackathon, we ran **Gemma 4 locally on a GPU** and measured **actual power consumption with a USB-connected measurement tool**. Our open-source project connects electricity use with token output to help data centers use limited power more efficiently.

<img src="docs/hackathon-team.jpg" alt="Team AC/DC working at the hackathon" width="560">

**[Run the demo](https://maxchamp2005-sudo.github.io/llm-energy-efficiency/#demo)** · **[View the five-slide pitch](https://maxchamp2005-sudo.github.io/llm-energy-efficiency/#pitch)** · **[Download the deck](docs/hackathon-pitch.pptx)**

## What we built

Alongside the local Gemma 4 measurement, we built a browser tool for comparing LLM batches. It accepts batch energy and token counts, reports **tokens per kWh** and **Wh per accepted task**, checks quality and response-time limits, and exports a JSON report.

A separate calculator estimates energy from **116 V AC, current, true power factor and run time**.

![Illustrative comparison: A passes the service limits; B uses less energy per task but fails them](docs/prototype-comparison.svg)

The browser demo uses **illustrative inputs**, separate from the Gemma 4 measurement: A accepts 96% of tasks at 820 ms p95. B accepts 94% at 1,120 ms. The rules require at least 95% acceptance and p95 at most 1,000 ms.

## Run locally

Download the repository and serve its root with any static web server. With Python installed:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000/. The site includes the demo and pitch; keep the `docs/` assets alongside `index.html`. Readable source is in [`src/`](src/).

To rebuild after editing `src/`, run `python3 build.py` (Python standard library only).

## License and references

Original source code is available under the [MIT license](LICENSE). The project owner supplied the team photo; third-party references retain their own terms.

[Measurement research and full technical deck](docs/research-deck.pptx).
