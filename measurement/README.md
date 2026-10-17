# Gemma 4 measurement tools

A source snapshot from cogni-ml, commit `d07e3089da3daf09f59b2d8da0604da4fd73ddd5`, used for the
hackathon's 48 / 32 / 16 / 48 decoder-depth experiment. This directory is
independent of the static pitch-site build. Run the commands below from here.
It includes collectors, the fixed-work request runner and its source dependencies,
report renderers, and their tests. Model weights and measurement recordings are
not included.

## Requirements

- Python 3.10+ (standard library only); the serial collector requires POSIX.
- Crystal 1.10+ for the request runner; no shards are required.
- Node.js 18+ for chart tests; a modern browser for generated HTML.
- NVIDIA drivers with `nvidia-smi` and `power.draw.instant` for GPU capture.
- An operator-managed llama-server and VictoriaMetrics on loopback HTTP.
- UT61B with its optical USB adapter, transmission enabled and serial-port access.

## Tools

| File | Purpose |
| --- | --- |
| `scripts/ut61b_telemetry.py` | Bounded UT61B serial capture, raw frames, current and receipt clocks |
| `scripts/gemma4_gpu_telemetry.py` | Bounded NVIDIA board power, utilization and memory capture |
| `scripts/prometheus_remote_write.py` | UT61B JSONL to Prometheus remote-write v1 |
| `bin/gemma4_layer_experiment.cr` | Fixed-token llama-server requests and timestamped received-token counters |
| `scripts/gemma4_same_clock_report.py` | Import all three streams, verify raw VM readback and align request windows |
| `scripts/gemma4_prune_layers.py` | Inspect GGUF and write experimental decoder-prefix copies |
| `scripts/gemma4_layer_report.py` | Validate/merge reports and render standalone HTML |
| `scripts/gemma4_depth_chart.js`, `.css` | 2D bounded Catmull-Rom chart and controls |
| `scripts/gemma4_energy_report.py` | Render existing Eco/Balanced/Quality report JSON |

## Capture on one host

Run the USB collector, GPU collector, inference runner and VictoriaMetrics on
the same host. Start both collectors before requests, in separate terminals;
each capture is bounded to at most 300 seconds and uses a fresh output path.
The GPU collector below retains raw samples; the report builder imports them.

```sh
mkdir -p .work
python3 scripts/ut61b_telemetry.py capture \
  --port /dev/ttyUSB0 --duration 300 --voltage 116 \
  --circuit gputer --output .work/ut61b.jsonl
```

```sh
python3 scripts/gemma4_gpu_telemetry.py \
  --run-label depth-demo --host gputer --gpu-index 0 \
  --duration-seconds 300 --interval-ms 250 --output .work/gpu.jsonl
```

Build the runner:

```sh
crystal build bin/gemma4_layer_experiment.cr --release -o .work/layer-experiment
```

With the desired model already loaded in llama-server, verify its actual decoder
count and GPU placement in the loader log. For example, a 32-layer batch is:

```sh
.work/layer-experiment --backend-url http://127.0.0.1:8080 \
  --vm-url http://127.0.0.1:8428 --layers 32 --label depth32 \
  --campaign-id depth-demo --model-file /path/to/gemma4-depth32.gguf \
  --tokens 256 --trials 3 --token-progress --output .work/depth32.json
```

The runner requires exact generated-token IDs and a token-limit stop. It ignores
EOS deliberately for fixed generated work. The `--layers` label does not alter
the running model. Collect batches in order 48-before, 32, 16 and 48-after using
the same campaign and request settings, fresh paths, and the appropriate loaded
model. Restore the full model for the final batch. Finish while both collectors
are still running, leaving coverage after the final request. The runner can
retain unavailable Fluke fields; the same-clock builder replaces the circuit
view with matched UT61B samples.

Once all three streams have been recorded:

```sh
python3 scripts/gemma4_same_clock_report.py \
  --input .work/depth48-before.json .work/depth32.json \
    .work/depth16.json .work/depth48-after.json \
  --gpu-jsonl .work/gpu.jsonl --ut61b-jsonl .work/ut61b.jsonl \
  --vm-url http://127.0.0.1:8428 --output .work/comparison.json \
  --evidence-prefix .work/depth-demo
python3 scripts/gemma4_layer_report.py render .work/comparison.json \
  --presentation-only --output .work/depth-explorer.html
python3 scripts/gemma4_layer_report.py render .work/comparison.json \
  --output .work/technical-report.html
```

The builder writes raw GPU, UT61B and token samples using remote-write, then
compares VM raw-export timestamps and values with the source records. HTTP write
success alone is insufficient. On delayed visibility, preserve the inputs and
retry with `--verify-existing` plus fresh output/evidence paths to avoid another
write. Missing coverage and invalid data remain explicit, never synthetic zero.
All VM URLs are restricted to credential-free loopback HTTP.

The standalone UT61B writer is also available for captures outside a campaign:

```sh
python3 scripts/prometheus_remote_write.py --input .work/ut61b.jsonl \
  --vm-url http://127.0.0.1:8428
```

## Experimental depth copies

Use a fresh output file and preserve the original model:

```sh
python3 scripts/gemma4_prune_layers.py inspect /path/to/gemma4.gguf
python3 scripts/gemma4_prune_layers.py prune /path/to/gemma4.gguf \
  --keep-blocks 32 --output .work/gemma4-depth32.gguf
python3 scripts/gemma4_prune_layers.py prune /path/to/gemma4.gguf \
  --keep-blocks 16 --output .work/gemma4-depth16.gguf
```

This is a guarded GGUF prefix-copy experiment, with cropped layer metadata,
unchanged retained tensors and a provenance manifest. Unsupported layouts fail.
It is different from `--gpu-layers`, which changes CPU/GPU placement. It has no
answer-quality guarantee; fewer weights alone cannot determine GPU wattage.

## Units and timing

- UT61B measures current. Assumed 116 V produces apparent power in VA and raw
  integrals in VA s. Power factor is not measured.
- The compact UT61B chart shows **estimated J/token with PF=1 assumed**:
  `integral(VA * PF dt) / N(t)`. At PF=1 the numerical value equals VA s/token.
  The assumption appears in the lower axis, selected metric and explanatory copy.
  The technical report and raw VM measurements retain their original units.
- `N(t)` counts received token IDs, held between events; ratios start at the
  first token and include prefill energy. Historical records without counters
  use final token count explicitly. VA/token is the alternate display mode.
- NVIDIA reports active GPU-board W, integrated into J. Its scope differs from
  the whole-circuit UT61B reading. Do not subtract them to infer PSU efficiency.
- Wall and monotonic clocks timestamp receipt on the host, not the underlying
  physical measurement or individual GPU token creation. Sensor averaging and
  transport lag remain. Smoothing affects display only, never raw integrals.
- Fixed generated work and a final full-depth drift check do not establish
  useful-answer efficiency, meter calibration or isolation from concurrent load.

## Software checks

These tests use synthetic fixtures and local HTTP servers; they need no GPU,
serial hardware, model weights, or running VictoriaMetrics.

```sh
python3 -m unittest discover -s spec -p 'test_*.py'
node --test spec/test_gemma4_depth_chart.js
node --check scripts/gemma4_depth_chart.js
crystal spec spec/gemma4_layer_experiment_spec.cr \
  spec/gemma4_token_progress_spec.cr spec/prometheus_remote_write_spec.cr \
  spec/victoria_metrics_energy_spec.cr spec/victoria_metrics_energy_http_spec.cr
```

All copied sources and tests retain their cogni-ml paths underneath this directory
so relative imports work. `src/ml/gguf/qwen35_*` and the option corridor are small
chat-template dependencies of the Gemma runner, not a second inference engine.
Re-run hardware/readback checks after backend, model, driver, clock, meter,
adapter, voltage or workload changes. Remove this directory and its README link
to roll back the source addition; stop bounded captures and restore the original
full-model service to roll back an experiment.
