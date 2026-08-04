import { describe, expect, it } from "vitest";
import {
  detectAmenitySignal,
  detectSourceUnavailableSignal,
  detectSourceUnavailableSignalFromHtml,
  parseEuroAmount,
} from "./text-signals";

describe("parseEuroAmount", () => {
  it("V14 distinguishes Austrian thousands groups from decimal forms", () => {
    expect(parseEuroAmount("2.850")).toBe(2850);
    expect(parseEuroAmount("4.878,69 €")).toBe(4878.69);
    expect(parseEuroAmount("386,03")).toBe(386.03);
    expect(parseEuroAmount("12.50")).toBe(12.5);
  });
});

describe("detectAmenitySignal", () => {
  it("V12 keeps explicit amenity negation from becoming a positive", () => {
    expect(
      detectAmenitySignal("No elevator in the building", ["elevator"]),
    ).toBe("NO");
    expect(detectAmenitySignal("Wohnung ohne Balkon", ["balkon"])).toBe("NO");
  });
});

describe("detectSourceUnavailableSignal", () => {
  it("recognizes a 200-OK 'no longer available' page as GONE", () => {
    expect(
      detectSourceUnavailableSignal(
        "<div>Diese Anzeige ist nicht mehr verfügbar</div>",
      ),
    ).toBe("GONE");
    expect(
      detectSourceUnavailableSignal(
        "Sorry, this listing is no longer available.",
      ),
    ).toBe("GONE");
  });

  it("recognizes an already-taken listing as RESERVED", () => {
    expect(
      detectSourceUnavailableSignal("Dieses Objekt ist bereits vermietet."),
    ).toBe("RESERVED");
  });

  it("returns null for a normal listing page", () => {
    expect(
      detectSourceUnavailableSignal(
        "Ruhige 2-Zimmer-Wohnung, verfügbar ab sofort.",
      ),
    ).toBeNull();
    expect(detectSourceUnavailableSignal(null)).toBeNull();
  });

  it("does not false-positive on an unrelated 'reserviert' mention", () => {
    // A reserved parking spot, not the apartment itself — should not match.
    expect(
      detectSourceUnavailableSignal("Ein Autoabstellplatz ist reserviert."),
    ).toBeNull();
  });
});

describe("detectSourceUnavailableSignalFromHtml", () => {
  it("ignores unavailable copy embedded in framework scripts", () => {
    expect(
      detectSourceUnavailableSignalFromHtml(
        '<main>Live apartment</main><script>"This listing is no longer available."</script>',
      ),
    ).toBeNull();
  });

  it("keeps visible unavailable notices", () => {
    expect(
      detectSourceUnavailableSignalFromHtml(
        "<main>This listing is no longer available.</main>",
      ),
    ).toBe("GONE");
  });
});
