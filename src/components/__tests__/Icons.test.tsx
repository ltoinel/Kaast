import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  IconPlus, IconPalette, IconDocument, IconFilm, IconScissors,
  IconUpload, IconTerminal, IconGear, IconSparkles, IconDownload,
  IconFilmSmall, IconEdit, IconEye, IconColumns, IconSave,
} from "../Icons";

const allIcons = [
  { name: "IconPlus", Component: IconPlus },
  { name: "IconPalette", Component: IconPalette },
  { name: "IconDocument", Component: IconDocument },
  { name: "IconFilm", Component: IconFilm },
  { name: "IconScissors", Component: IconScissors },
  { name: "IconUpload", Component: IconUpload },
  { name: "IconTerminal", Component: IconTerminal },
  { name: "IconGear", Component: IconGear },
  { name: "IconSparkles", Component: IconSparkles },
  { name: "IconDownload", Component: IconDownload },
  { name: "IconFilmSmall", Component: IconFilmSmall },
  { name: "IconEdit", Component: IconEdit },
  { name: "IconEye", Component: IconEye },
  { name: "IconColumns", Component: IconColumns },
  { name: "IconSave", Component: IconSave },
];

describe("Icons", () => {
  it.each(allIcons)("$name renders an SVG element", ({ Component }) => {
    const { container } = render(<Component />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it.each(allIcons)("$name has a viewBox attribute", ({ Component }) => {
    const { container } = render(<Component />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
  });
});
