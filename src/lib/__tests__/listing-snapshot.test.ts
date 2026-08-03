import { describe, expect, it } from "vitest";
import {
  changedSnapshotFields,
  readSnapshotFields,
} from "@/lib/listing-snapshot";

describe("listing snapshots", () => {
  it("stores and reads only changed fields", () => {
    const fields = changedSnapshotFields(
      { rooms: 2, baseRentAmount: 900 },
      { rooms: 2, baseRentAmount: 950 },
    );

    expect(fields).toEqual({
      baseRentAmount: { before: 900, after: 950 },
    });
    expect(readSnapshotFields(fields)).toEqual([
      {
        field: "baseRentAmount",
        before: 900,
        after: 950,
        hasBefore: true,
      },
    ]);
  });

  it("keeps legacy status and before/after snapshots readable", () => {
    expect(
      readSnapshotFields({ from: "NEW", to: "SHORTLISTED" })[0],
    ).toMatchObject({
      field: "status",
      before: "NEW",
      after: "SHORTLISTED",
    });
    expect(
      readSnapshotFields({
        baseRentAmountBefore: 900,
        baseRentAmountAfter: 950,
      })[0],
    ).toMatchObject({ field: "baseRentAmount", before: 900, after: 950 });
  });
});
