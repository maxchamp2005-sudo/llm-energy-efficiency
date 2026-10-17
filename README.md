# AI Energy Audit

At this hackathon, we built an open-source prototype that compares electricity per successful AI task for data centers with limited power.

<img src="docs/hackathon-team.jpg" alt="Building the energy prototype at the hackathon" width="560">

**[Run the demo](https://maxchamp2005-sudo.github.io/llm-energy-efficiency/#demo)** · **[View the five-slide pitch](https://maxchamp2005-sudo.github.io/llm-energy-efficiency/#pitch)** · **[Download the deck](docs/hackathon-pitch.pptx)**

## What we built

A browser tool that compares two batches of LLM work using energy, completed tasks, quality acceptance and response time. It reports **Wh per accepted task**, checks the service limits, and exports a JSON report. A separate calculator uses **116 V AC and true power factor** to estimate real power.

![Illustrative comparison: A passes the service limits; B uses less energy per task but fails them](docs/prototype-comparison.svg)

The example uses **illustrative inputs**: A accepts 96% of tasks at 820 ms p95. B accepts 94% at 1,120 ms. The rules require at least 95% acceptance and p95 at most 1,000 ms. These are demo values, not hardware results.

## Run locally

Download the repository and serve its root with any static web server. With Python installed:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000/. The site includes the demo and pitch; keep the `docs/` assets alongside `index.html`. Readable source is in [`src/`](src/).

To rebuild after editing `src/`, run `python3 build.py` (Python standard library only).

## Next measurement step

Connect real supply W/Wh and task logs over the same test window, then repeat a fixed workload. GPU telemetry provides a separate diagnostic. The current prototype uses entered data and does not include a meter or GPU collector.

[Measurement research and full technical deck](docs/research-deck.pptx). Original source code is under the [MIT license](LICENSE). The project owner supplied the team photo; third-party references retain their own terms.
