export type PinFilterState = {
  expectedClient: Set<string>;
  selling: Set<string>;
  creativePack: Set<string>;
  fullCampaign: Set<string>;
  /** Board Child "All Pins" — filter by exact pin name. */
  pinNames: Set<string>;
};

export function emptyPinFilters(): PinFilterState {
  return {
    expectedClient: new Set(),
    selling: new Set(),
    creativePack: new Set(),
    fullCampaign: new Set(),
    pinNames: new Set(),
  };
}

export function activeFilterCount(filters: PinFilterState) {
  return (
    filters.expectedClient.size +
    filters.selling.size +
    filters.creativePack.size +
    filters.fullCampaign.size +
    filters.pinNames.size
  );
}
