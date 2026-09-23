import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Button } from "./button"

// Smoke test for the RTL + jsdom + jest-dom wiring, using globals (no vitest imports).
describe("Button", () => {
  it("renders its label and handles clicks", async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save payroll</Button>)

    const button = screen.getByRole("button", { name: "Save payroll" })
    expect(button).toBeInTheDocument()

    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("does not fire when disabled", async () => {
    const onClick = vi.fn()
    render(
      <Button onClick={onClick} disabled>
        Locked
      </Button>,
    )

    await userEvent.click(screen.getByRole("button", { name: "Locked" }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
