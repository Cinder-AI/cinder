import assert from "assert";
import { 
  TestHelpers,
  Cinder_SetImageEvent
} from "generated";
const { MockDb, Cinder } = TestHelpers;

describe("Cinder contract SetImageEvent event tests", () => {
  // Create mock db
  const mockDb = MockDb.createMockDb();

  // Creating mock for Cinder contract SetImageEvent event
  const event = Cinder.SetImageEvent.mockData({
    asset: { bits: "0x01" },
    symbol: { case: "None", payload: undefined },
    sender: { case: "Address", payload: { bits: "0x02" } },
  });

  it("Cinder_SetImageEvent is created correctly", async () => {
    // Processing the event
    const mockDbUpdated = await Cinder.SetImageEvent.processEvent({
      event,
      mockDb,
    });

    // Getting the actual entity from the mock database
    let actualCinderSetImageEvent = mockDbUpdated.entities.Cinder_SetImageEvent.get(
      `${event.chainId}_${event.block.height}_${event.logIndex}`
    );

    // Creating the expected entity
    const expectedCinderSetImageEvent: Cinder_SetImageEvent = {
      id: `${event.chainId}_${event.block.height}_${event.logIndex}`,
    };
    // Asserting that the entity in the mock database is the same as the expected entity
    assert.deepEqual(actualCinderSetImageEvent, expectedCinderSetImageEvent, "Actual CinderSetImageEvent should be the same as the expectedCinderSetImageEvent");
  });
});
