# Measuring Power per LLM token

**Team AC/DC**

At this hackathon, we ran **Gemma 4 locally on a GPU** and recorded electrical load using a **USB-connected measurement tool**. Our open-source project connects electricity use with token output to help data centers with limited power evaluate efficiency.

<img src="docs/hackathon-team.jpg" alt="Team AC/DC working at the hackathon" width="560">

**[Run the demo](https://maxchamp2005-sudo.github.io/llm-energy-efficiency/#demo)** · **[View the six-slide pitch](https://maxchamp2005-sudo.github.io/llm-energy-efficiency/#pitch)** · **[Download the deck](docs/hackathon-pitch.pptx)**

## Isolated Enterprise Datacenter

Isolated enterprise data centers process all LLM requests on hardware within their own perimeter, without internet access. Their power budget limits the inference capacity available to users.

For a small-scale demonstration at the hackathon, we used a local workstation with two GPUs: an NVIDIA GeForce RTX 5060 and an AMD Radeon 7900.

![Dual-GPU workstation with electrical measurement equipment beside the computer](docs/isolated-datacenter-workstation.jpg)

*Hackathon workstation used for a small-scale demonstration.*

## Hackathon measurement trace

![UT61B apparent power trace at 116 V RMS, with apparent power in VA over elapsed seconds](docs/ut61b-apparent-power.jpg)

**Apparent power (VA) at 116 V RMS over elapsed time.** Real power (W) = apparent power (VA) × true power factor. Energy per token needs real watt-hours and matched token counts.

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

Original source code is available under the [MIT license](LICENSE). The project owner supplied the team and workstation photos; third-party references retain their own terms.

[Measurement research and full technical deck](docs/research-deck.pptx).
