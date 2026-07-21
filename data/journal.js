(() => {
  const pageElements = Array.from(document.querySelectorAll(".app-page"));
  const storyPage = document.querySelector("#storyPage");
  const keepsakePage = document.querySelector("#keepsakePage");
  const storyTimeline = document.querySelector("#storyTimeline");
  const summerGlanceGrid = document.querySelector("#summerGlanceGrid");
  const keepsakeNameInput = document.querySelector("#keepsakeNameInput");
  const keepsakeArtworkName = document.querySelector("#keepsakeArtworkName");
  const keepsakeArtworkCompleted = document.querySelector("#keepsakeArtworkCompleted");
  const keepsakeArtworkRank = document.querySelector("#keepsakeArtworkRank");
  const keepsakeBoard = document.querySelector("#keepsakeBoard");
  const keepsakePreviewStage = document.querySelector("#keepsakePreviewStage");
  const keepsakePreviewTransform = document.querySelector("#keepsakePreviewTransform");
  const keepsakeGeneratedPreview = document.querySelector("#keepsakeGeneratedPreview");
  const keepsakeShimmer = document.querySelector("#keepsakeShimmer");
  const keepsakeStatus = document.querySelector("#keepsakeStatus");
  const saveKeepsakeBtn = document.querySelector("#saveKeepsakeBtn");
  const shareKeepsakeBtn = document.querySelector("#shareKeepsakeBtn");
  const expandKeepsakeBtn = document.querySelector("#expandKeepsakeBtn");
  const closeKeepsakeFullscreenBtn = document.querySelector("#closeKeepsakeFullscreenBtn");

  let currentPage = "board";
  let keepsakeReturnPage = "board";
  let generatedKeepsake = null;
  let generatedKeepsakeUrl = "";
  const videoFrameCache = new Map();

  function completedEntries() {
    return orderedQuests()
      .map(quest => ({ quest, submission: completedSubmission(quest.id) }))
      .filter(entry => Boolean(entry.submission))
      .sort((a, b) => new Date(a.submission.completedAt || 0) - new Date(b.submission.completedAt || 0));
  }

  function localDateKey(value) {
    const date = new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return "undated";
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  }

  function formattedDate(value) {
    const date = new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return "Date not recorded";
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
    const rest = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date);
    return `${weekday} • ${rest}`;
  }

  function friendsLabel(value) {
    const count = Math.max(0, Math.trunc(Number(value) || 0));
    if (count === 0) return "Solo";
    return count === 1 ? "+1 friend" : `+${count} friends`;
  }

  function mediaMarkup(entry, className) {
    const { submission, quest } = entry;
    if (!submission.dataUrl) return "";
    const alt = `${quest.title} memory`;
    if (submission.mediaType?.startsWith("video/")) {
      return `<video class="${className}" src="${submission.dataUrl}" muted playsinline preload="metadata" aria-label="${escapeStoryText(alt)}"></video>`;
    }
    return `<img class="${className}" src="${submission.dataUrl}" alt="${escapeStoryText(alt)}" />`;
  }

  function renderStory() {
    const entries = completedEntries();
    const groups = [];
    entries.forEach((entry) => {
      const key = localDateKey(entry.submission.completedAt);
      let group = groups.at(-1);
      if (!group || group.key !== key) {
        group = { key, date: entry.submission.completedAt, entries: [] };
        groups.push(group);
      }
      group.entries.push(entry);
    });

    if (!groups.length) {
      storyTimeline.innerHTML = `
        <div class="story-empty-state">
          <p class="label">Your story starts here</p>
          <h2>Complete a quest to add your first memory.</h2>
          <button class="secondary-button" type="button" data-route="board">Back to Board</button>
        </div>`;
    } else {
      storyTimeline.innerHTML = groups.map((group, groupIndex) => `
        <section id="storyDate-${groupIndex}" class="story-date-group" aria-labelledby="storyDateTitle-${groupIndex}">
          <header class="story-date-heading">
            <span class="story-date-dot" aria-hidden="true"></span>
            <h2 id="storyDateTitle-${groupIndex}">${formattedDate(group.date)}</h2>
          </header>
          <div class="story-date-entries">
            ${group.entries.map(entry => {
              const location = String(entry.submission.location || "").trim();
              const caption = String(entry.submission.caption || "").trim();
              return `
                <article class="story-entry">
                  <header class="story-entry-header">
                    <h3>${escapeStoryText(entry.quest.title)}</h3>
                    <p>
                      ${location ? `<span>📍 ${escapeStoryText(location)}</span>` : ""}
                      <span>👥 ${friendsLabel(entry.submission.friends)}</span>
                    </p>
                  </header>
                  ${mediaMarkup(entry, "story-entry-photo")}
                  ${caption ? `<p class="story-caption">${escapeStoryText(caption)}</p>` : ""}
                </article>`;
            }).join("")}
          </div>
          <button class="story-next-date" type="button" data-next-target="${groupIndex === groups.length - 1 ? "summerGlance" : `storyDate-${groupIndex + 1}`}" aria-label="${groupIndex === groups.length - 1 ? "Jump to Summer at a Glance" : "Jump to next date"}">↓</button>
        </section>`).join("");
    }

    const totals = getTotals();
    const rank = currentRank(totals.score);
    const friends = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.submission.friends) || 0), 0);
    const glanceItems = [
      ["Completed Quests", totals.completed],
      ["Current Rank", rank.title],
      ["Points Earned", totals.score],
      ["Friends Joined", friends]
    ];
    summerGlanceGrid.innerHTML = glanceItems.map(([label, value]) => `
      <div class="summer-glance-item">
        <p>${label}</p>
        <strong>${escapeStoryText(value)}</strong>
      </div>`).join("");

    storyTimeline.querySelectorAll("video").forEach(async (video) => {
      const still = await captureVideoFrame(video.src);
      if (!still || !video.isConnected) return;
      const image = document.createElement("img");
      image.className = video.className;
      image.alt = video.getAttribute("aria-label") || "Quest memory";
      image.src = still;
      video.replaceWith(image);
    });
  }

  function categoryTileColor(index) {
    const palette = ["#f6b900", "#f35f59", "#1ba9b9"];
    return palette[index % palette.length];
  }

  function keepsakeTileMarkup(quest, index) {
    const submission = completedSubmission(quest.id);
    const isImage = submission?.dataUrl && !submission.mediaType?.startsWith("video/");
    if (isImage) {
      return `
        <div class="quest-card keepsake-quest-card is-photo" aria-label="${escapeStoryText(quest.title)}, completed">
          <img class="keepsake-tile-photo" src="${submission.dataUrl}" alt="" />
        </div>`;
    }
    return `
      <div class="quest-card keepsake-quest-card${quest.final ? " final-quest-card" : ""}" data-keepsake-quest="${quest.id}" style="--keepsake-tile-color:${categoryTileColor(index)}" aria-label="${escapeStoryText(quest.title)}">
        <span class="quest-card__visual is-open">
          <span class="quest-card-content">
            <img class="quest-illustration" src="${questIllustrationPath(quest, true)}" alt="" aria-hidden="true" />
            <span class="quest-title">${renderQuestTitle(quest.title)}</span>
          </span>
        </span>
      </div>`;
  }

  function renderKeepsake() {
    const totals = getTotals();
    const rank = currentRank(totals.score);
    keepsakeArtworkCompleted.textContent = `${totals.completed}/${window.QUESTS.length} Quests`;
    keepsakeArtworkRank.textContent = rank.title;
    keepsakeBoard.innerHTML = orderedQuests().map(keepsakeTileMarkup).join("");
    keepsakeBoard.querySelectorAll("[data-keepsake-quest]").forEach(async (tile) => {
      const submission = completedSubmission(Number(tile.dataset.keepsakeQuest));
      if (!submission?.dataUrl || !submission.mediaType?.startsWith("video/")) return;
      const still = await captureVideoFrame(submission.dataUrl);
      if (!still || !tile.isConnected) return;
      tile.classList.add("is-photo");
      tile.innerHTML = `<img class="keepsake-tile-photo" src="${still}" alt="" />`;
    });
    invalidateGeneratedKeepsake();
  }

  function validKeepsakeName() {
    return keepsakeNameInput.value.trim().length > 0;
  }

  function syncKeepsakeName() {
    const name = keepsakeNameInput.value.trim();
    keepsakeArtworkName.textContent = name || "Your Name";
    saveKeepsakeBtn.disabled = !name;
    shareKeepsakeBtn.disabled = !name;
    if (generatedKeepsake) invalidateGeneratedKeepsake();
  }

  function invalidateGeneratedKeepsake() {
    generatedKeepsake = null;
    if (generatedKeepsakeUrl) URL.revokeObjectURL(generatedKeepsakeUrl);
    generatedKeepsakeUrl = "";
    keepsakeGeneratedPreview.hidden = true;
    keepsakeGeneratedPreview.classList.remove("is-revealed");
    keepsakeGeneratedPreview.removeAttribute("src");
    document.querySelector("#keepsakeArtwork").hidden = false;
    saveKeepsakeBtn.disabled = !validKeepsakeName();
    shareKeepsakeBtn.disabled = !validKeepsakeName();
    keepsakeStatus.textContent = "";
  }

  async function captureVideoFrame(source) {
    if (!source) return "";
    if (videoFrameCache.has(source)) return videoFrameCache.get(source);
    const promise = new Promise((resolve) => {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      const finish = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 640;
          canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", .86));
        } catch (error) {
          resolve("");
        }
        video.removeAttribute("src");
        video.load();
      };
      video.addEventListener("loadeddata", () => {
        if (video.duration && Number.isFinite(video.duration)) {
          video.currentTime = Math.min(.15, video.duration / 2);
        } else {
          finish();
        }
      }, { once: true });
      video.addEventListener("seeked", finish, { once: true });
      video.addEventListener("error", () => resolve(""), { once: true });
      video.src = source;
    });
    videoFrameCache.set(source, promise);
    return promise;
  }

  function loadCanvasImage(source) {
    return new Promise((resolve) => {
      if (!source) return resolve(null);
      const image = new Image();
      image.decoding = "async";
      image.onload = async () => {
        try { await image.decode?.(); } catch (error) { /* Some browsers decode before onload. */ }
        resolve(image);
      };
      image.onerror = () => resolve(null);
      window.setTimeout(() => resolve(null), 6000);
      image.src = source;
    });
  }

  function roundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    if (typeof context.roundRect === "function") {
      context.roundRect(x, y, width, height, radius);
      return;
    }
    const right = x + width;
    const bottom = y + height;
    context.moveTo(x + radius, y);
    context.lineTo(right - radius, y);
    context.quadraticCurveTo(right, y, right, y + radius);
    context.lineTo(right, bottom - radius);
    context.quadraticCurveTo(right, bottom, right - radius, bottom);
    context.lineTo(x + radius, bottom);
    context.quadraticCurveTo(x, bottom, x, bottom - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }

  function drawCoverImage(context, image, x, y, width, height) {
    const scale = Math.max(width / image.width, height / image.height);
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    const sourceX = (image.width - sourceWidth) / 2;
    const sourceY = (image.height - sourceHeight) / 2;
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  }

  function wrapCanvasText(context, text, maxWidth, maxLines = 2) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    });
    if (line) lines.push(line);
    return lines.slice(0, maxLines);
  }

  async function renderKeepsakeCanvas() {
    await document.fonts?.ready;
    const quests = orderedQuests();
    const mediaSources = await Promise.all(quests.map(async (quest) => {
      const submission = completedSubmission(quest.id);
      if (!submission?.dataUrl) return "";
      return submission.mediaType?.startsWith("video/")
        ? captureVideoFrame(submission.dataUrl)
        : submission.dataUrl;
    }));
    const illustrations = quests.map(quest => questIllustrationPath(quest, true));
    const [mediaImages, iconImages] = await Promise.all([
      Promise.all(mediaSources.map(loadCanvasImage)),
      Promise.all(illustrations.map(loadCanvasImage))
    ]);

    const width = 1800;
    const height = 2100;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#f7f2e9";
    context.fillRect(0, 0, width, height);

    const margin = 60;
    context.textBaseline = "top";
    context.fillStyle = "#272522";
    context.font = '600 25px Montserrat, sans-serif';
    context.fillText("Hoa & Erika's Birthday Edition", margin, 64);
    context.font = '700 62px "Libre Baskerville", serif';
    context.fillStyle = "#f35f59";
    context.fillText("NYC Summer Quest", margin, 120);
    const totals = getTotals();
    const rank = currentRank(totals.score);
    context.textAlign = "right";
    context.fillStyle = "#272522";
    context.font = '600 25px Montserrat, sans-serif';
    context.fillText("August 2026", width - margin, 64);
    context.fillStyle = "#1ba9b9";
    context.font = '700 42px Montserrat, sans-serif';
    context.fillText(keepsakeNameInput.value.trim(), width - margin, 118);
    context.fillStyle = "#272522";
    context.font = '400 28px "Libre Baskerville", serif';
    context.fillText(rank.title, width - margin, 166);
    context.textAlign = "left";

    const boardX = margin;
    const boardY = 315;
    const boardSize = width - margin * 2;
    const gap = 22;
    const tileSize = (boardSize - gap * 4) / 5;
    quests.forEach((quest, index) => {
  const column = index % 5;
  const row = Math.floor(index / 5);
  const x = boardX + column * (tileSize + gap);
  const y = boardY + row * (tileSize + gap);

  context.save();
  roundedRect(context, x, y, tileSize, tileSize, 26);
  context.clip();

  if (mediaImages[index]) {
    drawCoverImage(
      context,
      mediaImages[index],
      x,
      y,
      tileSize,
      tileSize
    );
  } else {
    if (quest.final) {
      const gradient = context.createLinearGradient(
        x,
        y,
        x + tileSize,
        y + tileSize
      );

      gradient.addColorStop(0, "#fff4d5");
      gradient.addColorStop(.52, "#ead19a");
      gradient.addColorStop(1, "#f8e7bd");
      context.fillStyle = gradient;
    } else {
      context.fillStyle = categoryTileColor(index);
    }

    context.fillRect(x, y, tileSize, tileSize);

    if (iconImages[index]) {
      const iconSize = tileSize * .52;

      context.drawImage(
        iconImages[index],
        x + (tileSize - iconSize) / 2,
        y + (tileSize - iconSize) / 2,
        iconSize,
        iconSize
      );
    }
  }

  context.restore();

  context.strokeStyle = quest.final
    ? "rgba(157,112,29,.58)"
    : "rgba(39,37,34,.12)";

  context.lineWidth = 3;
  roundedRect(context, x, y, tileSize, tileSize, 26);
  context.stroke();
});

    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG generation failed")), "image/png");
    });
  }

  function setKeepsakeActionState(isPreparing) {
    saveKeepsakeBtn.disabled = isPreparing || !validKeepsakeName();
    shareKeepsakeBtn.disabled = isPreparing || !validKeepsakeName();
    saveKeepsakeBtn.textContent = isPreparing ? "Preparing keepsake..." : "Save to Camera Roll";
    shareKeepsakeBtn.textContent = isPreparing ? "Preparing keepsake..." : "Share";
  }

  async function generateKeepsake() {
    if (!validKeepsakeName()) {
      keepsakeNameInput.focus();
      return false;
    }
    setKeepsakeActionState(true);
    keepsakeGeneratedPreview.classList.remove("is-revealed");
    keepsakeStatus.textContent = "Preparing keepsake...";
    keepsakeShimmer.hidden = false;
    keepsakePreviewStage.classList.add("is-preparing");
    const start = performance.now();

    try {
      generatedKeepsake = await renderKeepsakeCanvas();
      const remaining = Math.max(0, 280 - (performance.now() - start));
      await new Promise(resolve => window.setTimeout(resolve, remaining));
      if (generatedKeepsakeUrl) URL.revokeObjectURL(generatedKeepsakeUrl);
      generatedKeepsakeUrl = URL.createObjectURL(generatedKeepsake);
      keepsakeGeneratedPreview.src = generatedKeepsakeUrl;
      keepsakeGeneratedPreview.hidden = false;
      document.querySelector("#keepsakeArtwork").hidden = true;
      requestAnimationFrame(() => keepsakeGeneratedPreview.classList.add("is-revealed"));
      keepsakeStatus.textContent = "Your keepsake is ready.";
      setKeepsakeActionState(false);
      return true;
    } catch (error) {
  console.error("Keepsake PNG generation failed:", error);
  keepsakeStatus.textContent = "We couldn't prepare the PNG. Please try again.";
  setKeepsakeActionState(false);
  return false;
} finally {
      keepsakeShimmer.hidden = true;
      keepsakePreviewStage.classList.remove("is-preparing");
    }
  }

  function safeFileName() {
    const name = keepsakeNameInput.value.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    return `${name || "summer-quest"}-memory-keepsake.png`;
  }

  function keepsakeFile() {
    return new File([generatedKeepsake], safeFileName(), { type: "image/png" });
  }

  async function openShareSheet() {
    if (!generatedKeepsake && !(await generateKeepsake())) return;
    if (!generatedKeepsake) return;
    const file = keepsakeFile();
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try {
        await navigator.share({ files: [file], title: "My NYC Summer Quest Keepsake" });
      } catch (error) {
        if (error.name !== "AbortError") downloadKeepsake();
      }
      return;
    }
    downloadKeepsake();
  }

  function downloadKeepsake() {
    if (!generatedKeepsakeUrl) return;
    const link = document.createElement("a");
    link.href = generatedKeepsakeUrl;
    link.download = safeFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function drawWrappedText(context, text, x, y, maxWidth, lineHeight, maxLines = Infinity) {
    const lines = wrapCanvasText(context, text, maxWidth, maxLines);
    lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
    return y + lines.length * lineHeight;
  }

  async function renderStoryPdfCanvas() {
    await document.fonts?.ready;
    const entries = completedEntries();
    const mediaImages = await Promise.all(entries.map(async (entry) => {
      const source = entry.submission.dataUrl;
      if (!source) return null;
      return loadCanvasImage(entry.submission.mediaType?.startsWith("video/")
        ? await captureVideoFrame(source)
        : source);
    }));

    const width = 900;
    const margin = 64;
    const contentWidth = width - margin * 2;
    let estimatedHeight = 360 + Math.max(1, entries.length) * 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = estimatedHeight;
    const context = canvas.getContext("2d", { alpha: false });

    const paintBackground = () => {
      context.fillStyle = "#f7f2e9";
      context.fillRect(0, 0, canvas.width, canvas.height);
    };
    paintBackground();
    context.textBaseline = "top";
    context.fillStyle = "#272522";
    context.font = '400 54px "Libre Baskerville", serif';
    context.fillText("My Summer Story", margin, 64);
    context.font = '600 16px Montserrat, sans-serif';
    context.fillStyle = "#1ba9b9";
    context.fillText("NYC SUMMER QUEST", margin, 132);

    let y = 190;
    if (!entries.length) {
      context.fillStyle = "#6f6a63";
      context.font = '400 24px Montserrat, sans-serif';
      y = drawWrappedText(context, "Complete a quest to add your first memory.", margin, y, contentWidth, 34, 3) + 40;
    } else {
      entries.forEach((entry, index) => {
        const image = mediaImages[index];
        const location = String(entry.submission.location || "").trim();
        const caption = String(entry.submission.caption || "").trim();
        context.fillStyle = "#1ba9b9";
        context.font = '700 15px Montserrat, sans-serif';
        context.fillText(formattedDate(entry.submission.completedAt).toUpperCase(), margin, y);
        y += 34;
        context.fillStyle = "#272522";
        context.font = '400 34px "Libre Baskerville", serif';
        y = drawWrappedText(context, entry.quest.title, margin, y, contentWidth, 44, 2) + 10;
        context.fillStyle = "#6f6a63";
        context.font = '500 16px Montserrat, sans-serif';
        const meta = [location && `Location: ${location}`, `Friends: ${friendsLabel(entry.submission.friends)}`].filter(Boolean).join("   ");
        if (meta) y = drawWrappedText(context, meta, margin, y, contentWidth, 24, 2) + 18;
        if (image) {
          const imageSize = Math.min(520, contentWidth);
          roundedRect(context, margin, y, imageSize, imageSize, 8);
          context.save();
          context.clip();
          drawCoverImage(context, image, margin, y, imageSize, imageSize);
          context.restore();
          y += imageSize + 20;
        }
        if (caption) {
          context.fillStyle = "#4f4a44";
          context.font = 'italic 22px "Libre Baskerville", serif';
          y = drawWrappedText(context, `"${caption}"`, margin, y, contentWidth, 34, 4) + 14;
        }
        y += 46;
      });
    }

    const totals = getTotals();
    const rank = currentRank(totals.score);
    context.strokeStyle = "rgba(157,112,29,.32)";
    context.beginPath();
    context.moveTo(margin, y);
    context.lineTo(width - margin, y);
    context.stroke();
    y += 34;
    context.fillStyle = "#87661f";
    context.font = '700 15px Montserrat, sans-serif';
    context.fillText("SUMMER AT A GLANCE", margin, y);
    y += 38;
    const glance = [
      ["Completed Quests", `${totals.completed}`],
      ["Current Rank", rank.title],
      ["Points Earned", `${totals.score}`],
      ["Friends Joined", `${entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.submission.friends) || 0), 0)}`]
    ];
    const columnWidth = contentWidth / 2;
    glance.forEach(([label, value], index) => {
      const x = margin + (index % 2) * columnWidth;
      const itemY = y + Math.floor(index / 2) * 92;
      context.fillStyle = "#6f6a63";
      context.font = '700 13px Montserrat, sans-serif';
      context.fillText(label.toUpperCase(), x, itemY);
      context.fillStyle = "#272522";
      context.font = '400 26px "Libre Baskerville", serif';
      drawWrappedText(context, value, x, itemY + 25, columnWidth - 18, 34, 2);
    });
    y += 220;

    if (y + margin < canvas.height) {
      const cropped = document.createElement("canvas");
      cropped.width = width;
      cropped.height = Math.ceil(y + margin);
      cropped.getContext("2d", { alpha: false }).drawImage(canvas, 0, 0);
      return cropped;
    }
    return canvas;
  }

  function binaryStringToBytes(value) {
    const bytes = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index += 1) bytes[index] = value.charCodeAt(index);
    return bytes;
  }

  function pdfFromJpegDataUrl(dataUrl, imageWidth, imageHeight) {
    const imageBinary = atob(dataUrl.split(",")[1]);
    const pageWidth = 612;
    const pageHeight = Math.round(pageWidth * imageHeight / imageWidth);
    const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`;
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
      `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBinary.length} >>\nstream\n${imageBinary}\nendstream`,
      `<< /Length ${content.length} >>\nstream\n${content}endstream`
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach(offset => {
      pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return new Blob([binaryStringToBytes(pdf)], { type: "application/pdf" });
  }

  async function exportStoryPdf() {
    const originalText = document.querySelector("#shareStoryBtn").textContent;
    document.querySelector("#shareStoryBtn").textContent = "Preparing PDF...";
    document.querySelector("#shareStoryBtn").disabled = true;
    try {
      const canvas = await renderStoryPdfCanvas();
      const jpegDataUrl = canvas.toDataURL("image/jpeg", .92);
      const pdfBlob = pdfFromJpegDataUrl(jpegDataUrl, canvas.width, canvas.height);
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "my-summer-story.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      document.querySelector("#shareStoryBtn").textContent = originalText;
      document.querySelector("#shareStoryBtn").disabled = false;
    }
  }

  async function saveKeepsake() {
    if (!generatedKeepsake && !(await generateKeepsake())) return;
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && navigator.share) {
      await openShareSheet();
    } else {
      downloadKeepsake();
    }
  }

  function navigateTo(page) {
    if (!pageElements.some(element => element.dataset.page === page)) return;
    if (page === "keepsake") {
      keepsakeReturnPage = currentPage === "keepsake" ? keepsakeReturnPage : currentPage;
      renderKeepsake();
    }
    if (page === "story") renderStory();
    pageElements.forEach(element => { element.hidden = element.dataset.page !== page; });
    currentPage = page;
    document.body.dataset.page = page;
    document.title = page === "story"
      ? "My Summer Story — NYC Summer Quest"
      : page === "keepsake"
        ? "Create Memory Keepsake — NYC Summer Quest"
        : "NYC Summer Quest";
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  const zoomState = { scale: 1, x: 0, y: 0, pointers: new Map(), start: null, pinch: null, moved: false };

  function applyPreviewTransform() {
    keepsakePreviewTransform.style.transform = `translate3d(${zoomState.x}px, ${zoomState.y}px, 0) scale(${zoomState.scale})`;
    keepsakePreviewStage.classList.toggle("is-zoomed", zoomState.scale > 1.01);
  }

  function clampPan() {
    const rect = keepsakePreviewStage.getBoundingClientRect();
    const maxX = rect.width * (zoomState.scale - 1) / 2;
    const maxY = rect.height * (zoomState.scale - 1) / 2;
    zoomState.x = Math.max(-maxX, Math.min(maxX, zoomState.x));
    zoomState.y = Math.max(-maxY, Math.min(maxY, zoomState.y));
  }

  function resetZoom() {
    zoomState.scale = 1;
    zoomState.x = 0;
    zoomState.y = 0;
    zoomState.pointers.clear();
    zoomState.start = null;
    zoomState.pinch = null;
    applyPreviewTransform();
  }

  function toggleZoom() {
    if (zoomState.scale > 1.01) resetZoom();
    else {
      zoomState.scale = 2;
      applyPreviewTransform();
    }
  }

  function pointerDistance(points) {
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  keepsakePreviewStage.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    keepsakePreviewStage.setPointerCapture(event.pointerId);
    zoomState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    zoomState.moved = false;
    if (zoomState.pointers.size === 1) {
      zoomState.start = { clientX: event.clientX, clientY: event.clientY, x: zoomState.x, y: zoomState.y, time: performance.now() };
    } else if (zoomState.pointers.size === 2) {
      zoomState.pinch = { distance: pointerDistance(Array.from(zoomState.pointers.values())), scale: zoomState.scale };
    }
  });

  keepsakePreviewStage.addEventListener("pointermove", (event) => {
    if (!zoomState.pointers.has(event.pointerId)) return;
    zoomState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (zoomState.pointers.size === 2 && zoomState.pinch) {
      event.preventDefault();
      const distance = pointerDistance(Array.from(zoomState.pointers.values()));
      zoomState.scale = Math.max(1, Math.min(4, zoomState.pinch.scale * distance / Math.max(1, zoomState.pinch.distance)));
      if (Math.abs(distance - zoomState.pinch.distance) > 5) zoomState.moved = true;
      clampPan();
      applyPreviewTransform();
    } else if (zoomState.pointers.size === 1 && zoomState.start && zoomState.scale > 1.01) {
      const dx = event.clientX - zoomState.start.clientX;
      const dy = event.clientY - zoomState.start.clientY;
      if (Math.hypot(dx, dy) > 5) zoomState.moved = true;
      zoomState.x = zoomState.start.x + dx;
      zoomState.y = zoomState.start.y + dy;
      clampPan();
      applyPreviewTransform();
    }
  });

  function releasePreviewPointer(event) {
    const wasTap = zoomState.pointers.size === 1 && !zoomState.moved && zoomState.start && performance.now() - zoomState.start.time < 320;
    zoomState.pointers.delete(event.pointerId);
    if (wasTap) toggleZoom();
    if (zoomState.pointers.size === 1) {
      const remaining = Array.from(zoomState.pointers.values())[0];
      zoomState.start = { clientX: remaining.x, clientY: remaining.y, x: zoomState.x, y: zoomState.y, time: performance.now() };
    } else if (!zoomState.pointers.size) {
      zoomState.start = null;
      zoomState.pinch = null;
    }
  }

  keepsakePreviewStage.addEventListener("pointerup", releasePreviewPointer);
  keepsakePreviewStage.addEventListener("pointercancel", releasePreviewPointer);

  function setFullscreenPreview(enabled) {
    keepsakePreviewStage.classList.toggle("is-fullscreen", enabled);
    closeKeepsakeFullscreenBtn.hidden = !enabled;
    expandKeepsakeBtn.hidden = enabled;
    document.body.classList.toggle("keepsake-preview-open", enabled);
    resetZoom();
  }

  document.addEventListener("click", (event) => {
    const route = event.target.closest("[data-route]")?.dataset.route;
    if (route) navigateTo(route);
  });
  document.querySelector("#viewBoardBtn").addEventListener("click", () => navigateTo("story"));
  document.querySelector("#saveBoardBtn").addEventListener("click", () => navigateTo("keepsake"));
  document.querySelector("#keepsakeBackBtn").addEventListener("click", () => navigateTo("board"));
  document.querySelector("#shareStoryBtn").addEventListener("click", exportStoryPdf);
  storyTimeline.addEventListener("click", (event) => {
    const targetId = event.target.closest("[data-next-target]")?.dataset.nextTarget;
    if (targetId) document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  keepsakeNameInput.addEventListener("input", syncKeepsakeName);
  saveKeepsakeBtn.addEventListener("click", saveKeepsake);
  shareKeepsakeBtn.addEventListener("click", openShareSheet);
  expandKeepsakeBtn.addEventListener("click", () => setFullscreenPreview(true));
  closeKeepsakeFullscreenBtn.addEventListener("click", () => setFullscreenPreview(false));
  keepsakePreviewStage.addEventListener("keydown", (event) => {
    if (["Enter", " "].includes(event.key)) {
      event.preventDefault();
      toggleZoom();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && keepsakePreviewStage.classList.contains("is-fullscreen")) setFullscreenPreview(false);
  });

  syncKeepsakeName();
})();
