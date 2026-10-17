(function () {
  "use strict";

  const sample = {
    submitted: 100,
    minAcceptance: 95,
    maxP95: 1000,
    aEnergy: 48,
    aCompleted: 100,
    aAccepted: 96,
    aTokens: 15500,
    aDuration: 12,
    aP95: 820,
    bEnergy: 39,
    bCompleted: 100,
    bAccepted: 94,
    bTokens: 15600,
    bDuration: 11,
    bP95: 1120,
    acVolts: 116,
    acAmps: 8,
    acPf: 0.92,
    acHours: 0.5
  };

  const $ = (id) => document.getElementById(id);
  const errorBox = $("formError");
  const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
  const integerFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
  const percentFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  function getNumber(id) {
    const el = $(id);
    if (!el || el.value.trim() === "") return null;
    const value = el.valueAsNumber;
    return Number.isFinite(value) ? value : null;
  }

  function validate() {
    const errors = [];
    const fields = [...document.querySelectorAll(".demo-main input[type=number]")];
    fields.forEach((field) => field.removeAttribute("aria-invalid"));

    function need(id, label, rule) {
      const value = getNumber(id);
      if (value === null || !rule(value)) {
        errors.push(label);
        $(id).setAttribute("aria-invalid", "true");
        return null;
      }
      return value;
    }

    const submitted = need("submitted", "Submitted tasks must be a positive whole number", (v) => Number.isInteger(v) && v > 0);
    const minAcceptance = need("minAcceptance", "Minimum accepted-task rate must be between 0% and 100%", (v) => v >= 0 && v <= 100);
    const maxP95 = need("maxP95", "Maximum p95 latency must be greater than zero", (v) => v > 0);

    const configs = {};
    ["a", "b"].forEach((prefix) => {
      const label = prefix.toUpperCase();
      const energy = need(`${prefix}Energy`, `Configuration ${label}: gross energy must be greater than zero`, (v) => v > 0);
      const completed = need(`${prefix}Completed`, `Configuration ${label}: completed tasks must be a whole number`, (v) => Number.isInteger(v) && v >= 0);
      const accepted = need(`${prefix}Accepted`, `Configuration ${label}: accepted tasks must be a whole number`, (v) => Number.isInteger(v) && v >= 0);
      const tokens = need(`${prefix}Tokens`, `Configuration ${label}: total output tokens must be a whole number`, (v) => Number.isInteger(v) && v >= 0);
      const duration = need(`${prefix}Duration`, `Configuration ${label}: batch duration must be greater than zero`, (v) => v > 0);
      const p95 = getNumber(`${prefix}P95`);
      if (p95 !== null && p95 <= 0) {
        errors.push(`Configuration ${label}: p95 latency must be greater than zero or left blank`);
        $(`${prefix}P95`).setAttribute("aria-invalid", "true");
      }
      configs[prefix] = { energy, completed, accepted, tokens, duration, p95 };
    });

    if (submitted !== null) {
      ["a", "b"].forEach((prefix) => {
        const config = configs[prefix];
        if (config.completed !== null && config.completed > submitted) {
          errors.push(`Configuration ${prefix.toUpperCase()}: completed tasks cannot exceed the fixed submitted task count`);
          $(`${prefix}Completed`).setAttribute("aria-invalid", "true");
        }
        if (config.accepted !== null && config.completed !== null && config.accepted > config.completed) {
          errors.push(`Configuration ${prefix.toUpperCase()}: quality-accepted tasks cannot exceed completed tasks`);
          $(`${prefix}Accepted`).setAttribute("aria-invalid", "true");
        }
      });
    }

    const acVolts = need("acVolts", "AC RMS voltage must be greater than zero", (v) => v > 0);
    const acAmps = need("acAmps", "AC RMS current must be zero or greater", (v) => v >= 0);
    const acPf = need("acPf", "True power factor must be greater than zero and no greater than one", (v) => v > 0 && v <= 1);
    const acHours = need("acHours", "AC duration must be zero or greater", (v) => v >= 0);

    if (errors.length) {
      errorBox.textContent = errors.join(". ") + ". Correct the highlighted values to update results.";
      errorBox.classList.add("visible");
      $("resultSummary").textContent = "Results are hidden until all inputs are valid.";
      $("resultSummary").dataset.tone = "blocked";
      $("resultCards").innerHTML = "";
      updateAC(null);
      return null;
    }
    errorBox.textContent = "";
    errorBox.classList.remove("visible");
    return { submitted, minAcceptance, maxP95, configs, acVolts, acAmps, acPf, acHours };
  }

  function derive(config, submitted, minAcceptance, maxP95) {
    const acceptanceRate = (config.accepted / submitted) * 100;
    const completionRate = (config.completed / submitted) * 100;
    const whPerAccepted = config.accepted > 0 ? config.energy / config.accepted : null;
    const tokensPerKwh = (config.tokens / config.energy) * 1000;
    const averageWatts = config.energy / (config.duration / 60);
    const reasons = [];
    let failed = false;

    if (config.accepted === 0) {
      reasons.push("no quality-accepted tasks, so Wh per accepted task is undefined");
      failed = true;
    }
    if (acceptanceRate < minAcceptance) {
      reasons.push(`accepted-task rate ${percentFormat.format(acceptanceRate)}% is below ${percentFormat.format(minAcceptance)}%`);
      failed = true;
    }
    if (config.p95 === null) {
      reasons.push("p95 latency is unverified");
    } else if (config.p95 > maxP95) {
      reasons.push(`p95 latency ${numberFormat.format(config.p95)} ms exceeds ${numberFormat.format(maxP95)} ms`);
      failed = true;
    }

    const status = failed ? "fail" : (config.p95 === null ? "unknown" : "eligible");
    return { ...config, acceptanceRate, completionRate, whPerAccepted, tokensPerKwh, averageWatts, reasons, status };
  }

  function fmt(value, digits = 2) {
    if (value === null || !Number.isFinite(value)) return "—";
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  }

  function metricCard(name, data, minAcceptance, maxP95, submitted) {
    const badge = data.status === "eligible"
      ? '<span class="gate-badge">Gate passed</span>'
      : data.status === "fail"
        ? '<span class="gate-badge fail">Gate failed</span>'
        : '<span class="gate-badge unknown">Unverified</span>';
    const acceptanceClass = data.acceptanceRate >= minAcceptance ? "good" : "bad";
    const latencyClass = data.p95 === null ? "" : (data.p95 <= maxP95 ? "good" : "bad");
    const status = data.reasons.length === 0 ? "Meets entered rules" : data.reasons.join("; ");
    return `<article class="result-card">
      <h3>${name}${badge}</h3>
      <dl class="metric-list">
        <dt>Gross Wh / accepted task</dt><dd class="primary-metric">${fmt(data.whPerAccepted, 3)} Wh</dd>
        <dt>Accepted / submitted</dt><dd class="${acceptanceClass}">${fmt(data.accepted, 0)} / ${fmt(submitted, 0)} · ${percentFormat.format(data.acceptanceRate)}%</dd>
        <dt>Completed / submitted</dt><dd>${fmt(data.completed, 0)} / ${fmt(submitted, 0)} · ${percentFormat.format(data.completionRate)}%</dd>
        <dt>Output tokens / kWh</dt><dd>${integerFormat.format(data.tokensPerKwh)}</dd>
        <dt>Average batch power</dt><dd>${fmt(data.averageWatts, 1)} W</dd>
        <dt>P95 latency / limit</dt><dd class="${latencyClass}">${data.p95 === null ? "Unverified" : `${fmt(data.p95, 0)} / ${fmt(maxP95, 0)} ms`}</dd>
        <dt>Service gate</dt><dd>${status}</dd>
      </dl>
    </article>`;
  }

  function interpretation(a, b) {
    const aOk = a.status === "eligible" && Number.isFinite(a.whPerAccepted);
    const bOk = b.status === "eligible" && Number.isFinite(b.whPerAccepted);
    const summary = $("resultSummary");
    if (aOk && bOk) {
      const delta = Math.abs(a.whPerAccepted - b.whPerAccepted);
      const lower = a.whPerAccepted <= b.whPerAccepted ? "Configuration A" : "Configuration B";
      const higher = a.whPerAccepted <= b.whPerAccepted ? "Configuration B" : "Configuration A";
      if (delta < 1e-9) {
        summary.textContent = "Both configurations meet the entered acceptance and latency gates, and their gross Wh per accepted task is equal at the displayed precision. This is an eligible comparison of the entered batch inputs, not a production result.";
      } else {
        const lowerValue = Math.min(a.whPerAccepted, b.whPerAccepted);
        const higherValue = Math.max(a.whPerAccepted, b.whPerAccepted);
        const reduction = ((higherValue - lowerValue) / higherValue) * 100;
        summary.textContent = `Both configurations meet the entered acceptance and latency gates. ${lower} has ${percentFormat.format(reduction)}% lower gross Wh per accepted task than ${higher} in these entered batch inputs. Treat this as a candidate result to repeat and validate, not a production claim.`;
      }
      summary.dataset.tone = "eligible";
      return;
    }

    if (aOk !== bOk) {
      const eligibleName = aOk ? "Configuration A" : "Configuration B";
      const otherName = aOk ? "Configuration B" : "Configuration A";
      const eligible = aOk ? a : b;
      const other = aOk ? b : a;
      let text = `${eligibleName} is the only configuration that clears the fully verified service gate in these inputs. ${otherName} is not eligible`;
      if (eligible.whPerAccepted !== null && other.whPerAccepted !== null && other.whPerAccepted < eligible.whPerAccepted) {
        const reduction = ((eligible.whPerAccepted - other.whPerAccepted) / eligible.whPerAccepted) * 100;
        text += `, even though its raw Wh per accepted task is ${percentFormat.format(reduction)}% lower`;
      }
      text += `. Do not declare an A/B energy winner while one configuration fails or has an unverified service gate.`;
      summary.textContent = text;
      summary.dataset.tone = "blocked";
      return;
    }

    summary.textContent = "Neither configuration has a fully verified passing service gate. There is no eligible energy comparison. Review acceptance and latency reasons below before interpreting Wh per task.";
    summary.dataset.tone = "blocked";
  }

  function updateAC(data) {
    if (!data) {
      $("acWatts").textContent = "—";
      $("acEnergy").textContent = "—";
      return;
    }
    const watts = data.acVolts * data.acAmps * data.acPf;
    const wh = watts * data.acHours;
    $("acWatts").textContent = `${fmt(watts, 1)} W`;
    $("acEnergy").textContent = `${fmt(wh, 1)} Wh`;
  }

  function render() {
    const data = validate();
    if (!data) return null;
    const a = derive(data.configs.a, data.submitted, data.minAcceptance, data.maxP95);
    const b = derive(data.configs.b, data.submitted, data.minAcceptance, data.maxP95);
    $("resultCards").innerHTML = metricCard("Configuration A", a, data.minAcceptance, data.maxP95, data.submitted) + metricCard("Configuration B", b, data.minAcceptance, data.maxP95, data.submitted);
    interpretation(a, b);
    updateAC(data);
    return { ...data, derived: { a, b } };
  }

  function exportReport() {
    const report = render();
    if (!report) return;
    const cleanConfig = (config) => ({
      grossSupplyEnergyWh: config.energy,
      completedTasks: config.completed,
      qualityAcceptedTasks: config.accepted,
      totalOutputTokens: config.tokens,
      durationMinutes: config.duration,
      p95LatencyMs: config.p95,
      derived: {
        grossWhPerAcceptedTask: config.whPerAccepted,
        outputTokensPerKwh: config.tokensPerKwh,
        averageBatchWatts: config.averageWatts,
        acceptedTaskRatePct: config.acceptanceRate,
        completedTaskRatePct: config.completionRate
      },
      serviceGate: { status: config.status, reasons: config.reasons }
    });
    const payload = {
      reportType: "illustrative browser-only LLM energy batch comparison",
      scope: "Batch-average figures from user-entered data; not causal per-request energy and not a real meter or GPU reading.",
      rules: {
        submittedTasks: report.submitted,
        minimumAcceptedTaskRatePct: report.minAcceptance,
        maximumP95LatencyMs: report.maxP95,
        p95Definition: "End-to-end request latency from service acceptance to final response, using the same definition and measurement window for both configurations.",
        eligibility: "A configuration must have at least one quality-accepted task, meet the accepted-task threshold, and have a measured p95 latency at or below the limit. Missing p95 is unverified and blocks an eligible comparison. A real pilot should set separate TTFT and TPOT gates."
      },
      configurations: { A: cleanConfig(report.derived.a), B: cleanConfig(report.derived.b) },
      acEstimate: {
        rmsVolts: report.acVolts,
        rmsAmps: report.acAmps,
        truePowerFactor: report.acPf,
        durationHours: report.acHours,
        estimatedRealPowerWatts: report.acVolts * report.acAmps * report.acPf,
        estimatedEnergyWh: report.acVolts * report.acAmps * report.acPf * report.acHours,
        formula: "P = Vrms * Irms * true power factor; E = P * duration"
      },
      notice: "Illustrative tool only. No production result, customer result, meter integration, GPU integration, or quality evaluation is implemented. Validate all inputs, boundaries, sensor scope, and service criteria independently."
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "llm-energy-batch-report.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  document.querySelectorAll(".demo-main input[type=number]").forEach((input) => {
    input.addEventListener("input", render);
    input.addEventListener("change", render);
  });

  $("resetSample").addEventListener("click", () => {
    Object.entries(sample).forEach(([id, value]) => { $(id).value = String(value); });
    $("resultContext").textContent = "Illustrative values · browser calculation";
    render();
  });
  $("clearP95").addEventListener("click", () => {
    $("aP95").value = "";
    $("bP95").value = "";
    render();
    $("aP95").focus();
  });
  $("exportReport").addEventListener("click", exportReport);
  render();
}());
