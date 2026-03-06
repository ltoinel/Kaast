import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApiKeySection from "../ApiKeySection";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "settings.apiKeyLabel": "API Key",
        "settings.hideKey": "Hide",
        "settings.showKey": "Show",
        "settings.save": "Save",
        "settings.delete": "Delete",
      };
      return translations[key] || key;
    },
  }),
}));

afterEach(cleanup);

const defaultProps = {
  icon: "key-icon",
  title: "Gemini API",
  description: "Enter your API key",
  inputId: "test-key",
  placeholder: "Enter key...",
  value: "",
  onChange: vi.fn(),
  onSave: vi.fn(),
  onClear: vi.fn(),
  isSaved: false,
  savedMessage: "Key saved!",
  externalUrl: "https://example.com",
  externalLabel: "Get key",
};

describe("ApiKeySection", () => {
  it("renders title and description", () => {
    const { getByText } = render(<ApiKeySection {...defaultProps} />);
    expect(getByText("Gemini API")).toBeDefined();
    expect(getByText("Enter your API key")).toBeDefined();
  });

  it("disables Save button when value is empty", () => {
    const { getByText } = render(<ApiKeySection {...defaultProps} />);
    const btn = getByText("Save").closest("button")!;
    expect(btn.disabled).toBe(true);
  });

  it("enables Save button when value is present", () => {
    const { getByText } = render(<ApiKeySection {...defaultProps} value="abc123" />);
    const btn = getByText("Save").closest("button")!;
    expect(btn.disabled).toBe(false);
  });

  it("calls onSave when Save is clicked", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { getByText } = render(<ApiKeySection {...defaultProps} value="abc" onSave={onSave} />);

    await user.click(getByText("Save").closest("button")!);
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("shows delete button only when value exists", () => {
    const { queryByTitle, rerender } = render(<ApiKeySection {...defaultProps} />);
    expect(queryByTitle("Delete")).toBeNull();

    rerender(<ApiKeySection {...defaultProps} value="abc" />);
    expect(queryByTitle("Delete")).not.toBeNull();
  });

  it("calls onClear when delete is clicked", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const { getByTitle } = render(<ApiKeySection {...defaultProps} value="abc" onClear={onClear} />);

    await user.click(getByTitle("Delete"));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("shows saved message when isSaved is true", () => {
    const { queryByText, rerender } = render(<ApiKeySection {...defaultProps} />);
    expect(queryByText("Key saved!")).toBeNull();

    rerender(<ApiKeySection {...defaultProps} isSaved={true} />);
    expect(queryByText("Key saved!")).not.toBeNull();
  });

  it("renders external link with correct URL", () => {
    const { getByText } = render(<ApiKeySection {...defaultProps} />);
    const link = getByText("Get key").closest("a")!;
    expect(link.getAttribute("href")).toBe("https://example.com");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    const { container, getByTitle } = render(<ApiKeySection {...defaultProps} value="secret" />);

    const input = container.querySelector("input")!;
    expect(input.type).toBe("password");

    await user.click(getByTitle("Show"));
    expect(input.type).toBe("text");

    await user.click(getByTitle("Hide"));
    expect(input.type).toBe("password");
  });

  it("calls onChange when typing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<ApiKeySection {...defaultProps} onChange={onChange} />);

    const input = container.querySelector("input")!;
    await user.type(input, "key");
    expect(onChange).toHaveBeenCalled();
  });
});
