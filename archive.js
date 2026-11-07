if (location.pathname === "/") {
  const oldLinks = { "#articles": "/articles", "#websites": "/websites", "#commissions": "/commissions", "#photos": "/commissions" };
  if (Object.hasOwn(oldLinks, location.hash)) location.replace(oldLinks[location.hash]);
}

const viewer = document.getElementById("image-viewer");
if (viewer) {
  const image = document.getElementById("viewer-image");
  for (const button of document.querySelectorAll(".gallery-item")) {
    button.addEventListener("click", () => {
      const thumbnail = button.querySelector("img");
      image.src = thumbnail.currentSrc || thumbnail.src;
      image.alt = thumbnail.alt;
      viewer.showModal();
    });
  }
  viewer.querySelector(".viewer-close").addEventListener("click", () => viewer.close());
  viewer.addEventListener("click", (event) => {
    if (event.target === viewer) viewer.close();
  });
  viewer.addEventListener("close", () => image.removeAttribute("src"));
}
