from __future__ import annotations

import base64
import hashlib
import html
import re
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "src"
DOCS = ROOT / "docs"
OUTPUT = ROOT / "index.html"


def main_inner(path: Path) -> str:
    source = path.read_text(encoding="utf-8")
    match = re.search(r"<main\b[^>]*>(.*?)</main>", source, re.S | re.I)
    if not match:
        raise ValueError(f"No main element found in {path}")
    return match.group(1).strip()


def data_url(path: Path, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def escape_script_string(value: str) -> str:
    # The data URLs contain only base64 characters, but also escape HTML script delimiters
    # so the generated source stays safe if this helper is reused with other payloads.
    return value.replace("</", "<\\/")


def main() -> None:
    css = (SOURCE / "styles.css").read_text(encoding="utf-8")
    hero = "docs/hackathon-team.jpg"
    css = css.replace('url("assets/llm-energy-hero.png")', 'none')

    home = main_inner(SOURCE / "index.html")
    home = home.replace('src="assets/hackathon-team.jpg"', f'src="{hero}"')
    home = home.replace('src="assets/prototype-comparison.svg"', 'src="docs/prototype-comparison.svg"')
    demo = main_inner(SOURCE / "demo/index.html")
    pitch = main_inner(SOURCE / "pitch/index.html")

    # Convert every local page link into one of the declared in-document routes.
    home = home.replace('href="demo/"', 'href="#demo"').replace('href="pitch/"', 'href="#pitch"')
    demo = demo.replace('href="../"', 'href="#top"')
    pitch = pitch.replace('href="../"', 'href="#top"')
    pitch = pitch.replace('href="../#case"', 'href="#case"')
    pitch = pitch.replace('href="../demo/"', 'href="#demo"')
    pitch = pitch.replace('href="../pitch-deck.pptx" download', 'href="#pitch" data-download-pptx')
    pitch = pitch.replace(' src="../assets/pitch/slide-1.jpg"', '')

    deck_version = hashlib.sha256((DOCS / "hackathon-pitch.pptx").read_bytes()).hexdigest()[:12]
    slides = []
    with zipfile.ZipFile(DOCS / "hackathon-pitch.pptx") as deck_zip:
        slide_count = len([n for n in deck_zip.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)])
    for n in range(1, slide_count + 1):
        slide_version = hashlib.sha256((DOCS / f"slide-{n}.jpg").read_bytes()).hexdigest()[:12]
        suffix = f"?v={slide_version}"
        slides.append(f'    {n}: "docs/slide-{n}.jpg{suffix}"')
    slide_map = "const slideImages = {\n" + ",\n".join(slides) + "\n  };"

    demo_js = (SOURCE / "demo/demo.js").read_text(encoding="utf-8").strip()
    viewer_js = (SOURCE / "pitch/viewer.js").read_text(encoding="utf-8").strip()
    viewer_js = viewer_js.replace('../assets/pitch/slide-${slide}.jpg', '${window.slideImages[slide]}')
    viewer_js = viewer_js.replace('`../assets/pitch/slide-${current}.jpg`', 'window.slideImages[current]')
    viewer_js = viewer_js.replace('if (selected) button.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });',
                                  'if (selected && button.getClientRects().length) button.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });')
    viewer_js = viewer_js.replace('  show(current, false);',
                                  '  show(current, false);\n  window.addEventListener("pitchviewshown", () => {\n    const selected = thumbs[current - 1];\n    if (selected && selected.getClientRects().length) selected.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });\n  });')

    nav_home = '''<a href="#trace">Measurement</a>
      <a href="#method">Technical notes</a>
      <a href="https://github.com/maxchamp2005-sudo/llm-energy-efficiency">GitHub</a>
      <a class="nav-cta" href="#demo">Run demo <span aria-hidden="true">↗</span></a>'''

    shell = f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#171918">
  <meta name="description" content="Team AC/DC recorded electrical load during local Gemma 4 inference. Explore the UT61B apparent-power trace and LLM batch comparison.">
  <title>AC/DC · Measuring Power per LLM token</title>
  <style>
{css}
    .page-view[hidden] {{ display: none !important; }}
  </style>
</head>
<body class="subpage">
  <a class="skip-link" href="#content">Skip to content</a>
  <header class="site-header">
    <a class="wordmark" href="#top" aria-label="Team AC/DC home">TEAM AC/DC <small>LLM ENERGY STUDY</small></a>
    <nav class="main-nav" id="mainNav" aria-label="Main navigation">
      {nav_home}
    </nav>
  </header>

  <main id="content" tabindex="-1">
    <div class="page-view" id="view-home" data-view="home">
{home}
    </div>
    <div class="page-view" id="view-demo" data-view="demo" hidden>
{demo}
    </div>
    <div class="page-view" id="view-pitch" data-view="pitch" hidden>
{pitch}
    </div>
  </main>

  <footer class="site-footer">
    <div class="wrap footer-content">
      <a class="footer-brand" href="#top">TEAM AC/DC</a>
      <span id="footerContext">Local Gemma 4 measurement · Code and presentation on GitHub</span>
      <div><a href="#top">Home</a><a href="#demo">Browser demo</a><a href="#pitch">Pitch deck</a><a href="https://github.com/maxchamp2005-sudo/llm-energy-efficiency">GitHub ↗</a></div>
    </div>
  </footer>

  <script>
  (function () {{
    "use strict";
    {slide_map}
    window.slideImages = slideImages;
    window.downloadPitchDeck = function () {{
      const download = document.createElement("a");
      download.href = "docs/hackathon-pitch.pptx?v={deck_version}";
      download.download = "hackathon-pitch.pptx";
      document.body.appendChild(download);
      download.click();
      download.remove();
    }};
  }})();
  </script>
  <script>
{demo_js}
  </script>
  <script>
{viewer_js}
  </script>
  <script>
  (function () {{
    "use strict";
    const nav = document.getElementById("mainNav");
    const footerContext = document.getElementById("footerContext");
    const views = {{
      home: document.getElementById("view-home"),
      demo: document.getElementById("view-demo"),
      pitch: document.getElementById("view-pitch")
    }};
    const navMarkup = {{
      home: `{nav_home}`,
      demo: `<a href="#trace">Measurement</a><a href="#method">Technical notes</a><a href="https://github.com/maxchamp2005-sudo/llm-energy-efficiency">GitHub</a><a class="nav-cta" href="#pitch">Short pitch <span aria-hidden="true">↗</span></a>`,
      pitch: `<a href="#trace">Measurement</a><a href="#demo">Browser demo</a><a class="nav-cta" href="#pitch" data-download-pptx>Download PPTX <span aria-hidden="true">↓</span></a>`
    }};
    const footerText = {{
      home: "Local Gemma 4 measurement · Code and presentation on GitHub",
      demo: "Illustrative browser demo · No production results claimed",
      pitch: "Hackathon pitch · Six slides"
    }};
    let current = "home";

    function selectPage(page, hash) {{
      if (!views[page]) return;
      current = page;
      Object.entries(views).forEach(([name, element]) => {{ element.hidden = name !== page; }});
      nav.innerHTML = navMarkup[page];
      footerContext.textContent = footerText[page];
      if (page === "pitch") window.dispatchEvent(new Event("pitchviewshown"));
      if (["datacenter", "trace", "case", "method", "pilot", "top"].includes(hash)) {{
        window.requestAnimationFrame(() => {{
          const target = document.getElementById(hash);
          if (target) {{
            let parent = target.closest("details");
            if (parent) parent.open = true;
            target.scrollIntoView({{ behavior: "smooth", block: "start" }});
          }}
          else window.scrollTo({{ top: 0, behavior: "smooth" }});
        }});
      }} else if (hash === "demo" || hash === "pitch") {{
        window.scrollTo({{ top: 0, behavior: "auto" }});
      }}
    }}

    function route() {{
      const hash = decodeURIComponent(location.hash.slice(1));
      if (hash === "demo" || hash === "pitch") selectPage(hash, hash);
      else if (["datacenter", "trace", "case", "method", "pilot", "top"].includes(hash)) selectPage("home", hash);
      else if (!hash) selectPage("home", "");
      else if (hash !== "content") selectPage(current, "");
    }}

    document.addEventListener("click", (event) => {{
      const link = event.target.closest("a[data-download-pptx]");
      if (!link) return;
      event.preventDefault();
      window.downloadPitchDeck();
    }});
    window.addEventListener("hashchange", route);
    route();
  }})();
  </script>
</body>
</html>
'''

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(shell, encoding="utf-8")
    print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
