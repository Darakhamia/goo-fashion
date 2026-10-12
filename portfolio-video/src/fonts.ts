// Inter Tight, the app's only text face (next/font in src/app/layout.tsx),
// bundled from @fontsource so no frame waits on Google Fonts.
import "@fontsource/inter-tight/400.css";
import "@fontsource/inter-tight/500.css";
import "@fontsource/inter-tight/600.css";
import "@fontsource/inter-tight/700.css";
import "@fontsource/inter-tight/800.css";
import "@fontsource/inter-tight/900.css";
import { continueRender, delayRender } from "remotion";

const WEIGHTS = [400, 500, 600, 700, 800, 900];

// CSS faces load lazily; hold the first frame until every weight is in.
const handle = delayRender("Loading Inter Tight");
Promise.all(WEIGHTS.map((w) => document.fonts.load(`${w} 16px "Inter Tight"`)))
  .then(() => continueRender(handle))
  .catch((err) => {
    console.error(err);
    continueRender(handle);
  });
