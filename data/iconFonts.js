(() => {
  const root = document.documentElement;
  const fontLoads = [
    {
      family: "Material Symbols Outlined",
      className: "material-symbols-outlined-ready"
    },
    {
      family: "Material Symbols Rounded",
      className: "material-symbols-rounded-ready"
    }
  ];

  if (!document.fonts?.load) return;

  fontLoads.forEach(({ family, className }) => {
    document.fonts
      .load(`400 24px "${family}"`, "close")
      .then(fontFaces => {
        if (fontFaces.length > 0) root.classList.add(className);
      })
      .catch(() => {
        // Icon ligature text remains hidden when the local font is unavailable.
      });
  });
})();
