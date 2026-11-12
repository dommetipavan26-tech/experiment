import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, CategoryIcon, EmptyState, SeverityBadge, Sparkline, StatusBadge } from "./ui";
import { Inbox } from "lucide-react";

describe("shared UI primitives", () => {
  it("renders labelled badges for severity and status", () => {
    render(
      <div>
        <SeverityBadge severity="critical" />
        <StatusBadge status="responding" />
        <Badge tone="teal" dot>Verified</Badge>
      </div>,
    );
    expect(screen.getByText("Critical").textContent).toBe("Critical");
    expect(screen.getByText("Responding").textContent).toBe("Responding");
    expect(screen.getByText("Verified").textContent).toBe("Verified");
  });

  it("renders category icons with accessible titles", () => {
    const { container } = render(<CategoryIcon category="power" size={18} />);
    expect(container.querySelector("span[title='Power']")).not.toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("draws a sparkline path from the data series", () => {
    const { container } = render(<Sparkline data={[0, 3, 1, 5, 2]} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-label")).toContain("Field signal volume");
    expect(svg?.querySelectorAll("path")).toHaveLength(2);
    expect(svg?.querySelectorAll("circle")).toHaveLength(5);
  });

  it("renders an empty state with its detail", () => {
    render(<EmptyState icon={<Inbox size={20} />} title="Queue is clear" detail="Nothing to review" />);
    expect(screen.getByText("Queue is clear")).not.toBeNull();
    expect(screen.getByText("Nothing to review")).not.toBeNull();
  });
});
