(function () {
  "use strict";
  const total = window.slideImages ? Object.keys(window.slideImages).length : 8;
  const image = document.getElementById("mainSlide");
  const strip = document.getElementById("thumbnails");
  const previous = document.getElementById("previous");
  const next = document.getElementById("next");
  const stage = document.getElementById("slideStage");
  const fullscreen = document.getElementById("fullscreen");
  const title = document.getElementById("slideTitle");
  const inlineCount = document.getElementById("currentSlideInline");
  const thumbs = [];
  const requested = Number.parseInt(new URL(location.href).searchParams.get("slide"), 10);
  let current = Number.isInteger(requested) && requested >= 1 && requested <= total ? requested : 1;

  for (let slide = 1; slide <= total; slide += 1) {
    const button = document.createElement("button");
    button.className = "thumb";
    button.type = "button";
    button.setAttribute("aria-label", `Go to slide ${slide}`);
    button.setAttribute("aria-current", "false");
    button.innerHTML = `<img src="../assets/pitch/slide-${slide}.jpg" alt="" loading="lazy" decoding="async"><span>SLIDE ${String(slide).padStart(2, "0")}</span>`;
    button.addEventListener("click", () => show(slide));
    strip.appendChild(button);
    thumbs.push(button);
  }

  function show(slide, updateAddress = true) {
    current = Math.max(1, Math.min(total, slide));
    image.src = `../assets/pitch/slide-${current}.jpg`;
    image.alt = `Slide ${current} of ${total}`;
    title.textContent = `Slide ${current} of ${total}`;
    inlineCount.textContent = String(current);
    previous.disabled = current === 1;
    next.disabled = current === total;
    thumbs.forEach((button, index) => {
      const selected = index + 1 === current;
      button.setAttribute("aria-current", selected ? "true" : "false");
      if (selected) button.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    });
    if (updateAddress) {
      const url = new URL(location.href);
      url.searchParams.set("slide", String(current));
      history.replaceState(null, "", url);
    }
  }

  previous.addEventListener("click", () => show(current - 1));
  next.addEventListener("click", () => show(current + 1));
  document.addEventListener("keydown", (event) => {
    if (!stage.getClientRects().length) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const tag = event.target && event.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || event.target.isContentEditable) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); show(current - 1); }
    else if (event.key === "ArrowRight" || event.key === " ") { event.preventDefault(); show(current + 1); }
    else if (event.key === "Home") { event.preventDefault(); show(1); }
    else if (event.key === "End") { event.preventDefault(); show(total); }
  });

  let touchStart = null;
  stage.addEventListener("touchstart", (event) => {
    if (event.changedTouches.length) touchStart = event.changedTouches[0].clientX;
  }, { passive: true });
  stage.addEventListener("touchend", (event) => {
    if (touchStart === null || !event.changedTouches.length) return;
    const delta = event.changedTouches[0].clientX - touchStart;
    if (Math.abs(delta) > 60) show(current + (delta < 0 ? 1 : -1));
    touchStart = null;
  }, { passive: true });

  fullscreen.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stage.requestFullscreen();
    } catch (_) {
      fullscreen.textContent = "Full screen unavailable";
    }
  });
  document.addEventListener("fullscreenchange", () => {
    fullscreen.innerHTML = document.fullscreenElement
      ? 'Exit full screen <span aria-hidden="true">⛶</span>'
      : 'Enter full screen <span aria-hidden="true">⛶</span>';
  });

  show(current, false);
}());
