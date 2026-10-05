import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { TextField } from "./text-field";

test("text field labels its input", () => {
  render(<TextField label="Email" name="email" type="email" />);

  const input = screen.getByLabelText("Email");
  expect(input.getAttribute("name")).toBe("email");
  expect(input.getAttribute("type")).toBe("email");
});
