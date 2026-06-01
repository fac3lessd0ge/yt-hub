import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProxySetting } from "@/components/settings/ProxySetting";

describe("ProxySetting", () => {
  it("commits a valid trimmed proxy on blur", () => {
    const onChange = vi.fn();
    render(<ProxySetting value="" onChange={onChange} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, {
      target: { value: "  socks5://127.0.0.1:2080 " },
    });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith("socks5://127.0.0.1:2080");
  });

  it("shows an error and does not commit an invalid proxy", () => {
    const onChange = vi.fn();
    render(<ProxySetting value="" onChange={onChange} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "not-a-proxy" } });
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("commits an empty value (clearing the proxy)", () => {
    const onChange = vi.fn();
    render(
      <ProxySetting value="socks5://127.0.0.1:2080" onChange={onChange} />,
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith("");
  });
});
