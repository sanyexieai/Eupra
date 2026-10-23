import zh from "./locales/zh-CN.json";
type Key = keyof typeof zh;
export async function downloadExamplePoster(
  moon: boolean,
  t: (k: Key) => string,
) {
  const image = new Image();
  image.src = "/assets/" + (moon ? "cat-moon-hero.webp" : "cat-ceo-hero.webp");
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("canvas");
  ctx.fillStyle = "#080b18";
  ctx.fillRect(0, 0, 1080, 1350);
  const scale = Math.max(1080 / image.width, 980 / image.height);
  const w = image.width * scale,
    h = image.height * scale;
  ctx.drawImage(image, (1080 - w) / 2, (980 - h) / 2, w, h);
  const grad = ctx.createLinearGradient(0, 650, 0, 1000);
  grad.addColorStop(0, "#080b1800");
  grad.addColorStop(1, "#080b18");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 650, 1080, 400);
  ctx.fillStyle = "#d9b7ff";
  ctx.font = "24px sans-serif";
  ctx.fillText(t("posterLabel"), 55, 1040);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 48px sans-serif";
  const title = t(moon ? "moon" : "ceo");
  let line = "",
    y = 1120;
  for (const c of title) {
    if (ctx.measureText(line + c).width > 960) {
      ctx.fillText(line, 55, y);
      y += 65;
      line = "";
    }
    line += c;
  }
  ctx.fillText(line, 55, y);
  ctx.fillStyle = "#a59bb8";
  ctx.font = "25px sans-serif";
  ctx.fillText(t("posterBrand"), 55, 1290);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(Error("blob"))), "image/png"),
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "eupra-labeled-design-example.png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
